import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

const SYSTEM_PROMPT = `You are TechForce AI — an intelligent assistant for Multicorp Fire Protection Services, a commercial fire protection company based in Columbia, MD. You act as a personalized secretary for managers and supervisors.

You help with:
- Scheduling and managing appointments (meetings, site visits, calls)
- Creating jobs and work orders for customers at specific locations
- Generating service estimates and quotes
- Creating and managing invoices
- Looking up customer, employee, and job information
- Answering questions about the business

Company info:
- Name: Multicorp Fire Protection Services
- Address: 9693 Gerwig Lane, Columbia MD 21046
- Phone: (410) 876-5000
- Services: Sprinkler inspection, Suppression inspection, Extinguisher inspection, Fire alarm inspection

Customer & Location model:
- Each customer can have MULTIPLE service locations (e.g. a restaurant chain with multiple branches).
- When creating a job, always ask which specific location if the customer has multiple locations.
- Jobs are tracked per customer AND per location so service history is organized by site.

When creating appointments, jobs, or invoices, always confirm the action with the user and summarize what you created.
When a user asks you to do something, use the available tools/functions to take real action — don't just describe what to do.
Be concise, professional, and proactive. If you're missing information, ask for just what you need.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_customers",
      description: "List all customers in the system",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_employees",
      description: "List all active employees/technicians",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List recent jobs, optionally filtered by status",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: pending, completed, in_progress, return, reschedule" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_appointments",
      description: "List upcoming appointments",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description: "Create a new appointment or meeting",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          startTime: { type: "string", description: "HH:MM (24h)" },
          endTime: { type: "string" },
          type: { type: "string", enum: ["meeting", "site-visit", "call", "internal", "other"] },
          description: { type: "string" },
          participants: { type: "string" },
          location: { type: "string" },
          notes: { type: "string" },
        },
        required: ["title", "date", "startTime", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_job",
      description: "Create a new job/work order for a customer",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string", description: "Convex customer ID" },
          locationName: { type: "string" },
          serviceType: { type: "string" },
          scheduledDate: { type: "string", description: "YYYY-MM-DD" },
          scheduledTime: { type: "string", description: "HH:MM" },
          dueDate: { type: "string" },
          employeeId: { type: "string", description: "Convex employee ID (optional)" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          revenue: { type: "number" },
          notes: { type: "string" },
        },
        required: ["customerId", "serviceType", "scheduledDate", "scheduledTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description: "Create a new invoice for a customer",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          serviceType: { type: "string" },
          totalAmount: { type: "number" },
        },
        required: ["customerId", "serviceType", "totalAmount"],
      },
    },
  },
];

// ─── Conversation management (queries/mutations) ──────────────────────────────

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const convs = await ctx.db.query("conversations").collect();
    return convs.reverse();
  },
});

export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
  },
});

export const createConversation = mutation({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    return await ctx.db.insert("conversations", { title });
  },
});

export const saveMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { conversationId, role, content }) => {
    return await ctx.db.insert("messages", { conversationId, role, content });
  },
});

// ─── AI Action — calls OpenAI and handles tool calls ────────────────────────

export const chat = action({
  args: {
    conversationId: v.id("conversations"),
    userMessage: v.string(),
  },
  handler: async (ctx, { conversationId, userMessage }): Promise<string> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured in Convex environment variables");

    // Save user message
    await ctx.runMutation(api.ai.saveMessage, {
      conversationId,
      role: "user",
      content: userMessage,
    });

    // Load conversation history
    const history = await ctx.runQuery(api.ai.getMessages, { conversationId });

    type ChatMessage =
      | { role: "system"; content: string }
      | { role: "user"; content: string }
      | { role: "assistant"; content: string | null; tool_calls?: unknown[] }
      | { role: "tool"; content: string; tool_call_id: string };

    const chatMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // Fetch live data for tool calls
    async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
      if (name === "list_customers") {
        const customers = await ctx.runQuery(api.customers.list, {});
        return JSON.stringify(
          (customers as { _id: string; name: string; address: string; contactName: string; isActive: boolean }[])
            .filter((c) => c.isActive)
            .slice(0, 20)
            .map((c) => ({ id: c._id, name: c.name, address: c.address, contactName: c.contactName }))
        );
      }

      if (name === "list_employees") {
        const employees = await ctx.runQuery(api.employees.list, {});
        return JSON.stringify(
          (employees as { _id: string; name: string; role: string; certifications: string[]; isActive: boolean }[])
            .filter((e) => e.isActive)
            .slice(0, 20)
            .map((e) => ({ id: e._id, name: e.name, role: e.role, certifications: e.certifications }))
        );
      }

      if (name === "list_jobs") {
        const status = typeof args.status === "string" ? args.status : undefined;
        const jobs = await ctx.runQuery(api.jobs.list, { status });
        return JSON.stringify(
          (jobs as { _id: string; customerName: string; serviceType: string; status: string; scheduledDate?: string; revenue: number }[])
            .slice(0, 15)
            .map((j) => ({ id: j._id, customerName: j.customerName, serviceType: j.serviceType, status: j.status, scheduledDate: j.scheduledDate, revenue: j.revenue }))
        );
      }

      if (name === "list_appointments") {
        const appts = await ctx.runQuery(api.appointments.list, {});
        return JSON.stringify((appts as unknown[]).slice(0, 20));
      }

      if (name === "create_appointment") {
        const id = await ctx.runMutation(api.appointments.create, {
          title: String(args.title ?? ""),
          date: String(args.date ?? ""),
          startTime: String(args.startTime ?? ""),
          endTime: args.endTime ? String(args.endTime) : undefined,
          type: String(args.type ?? "meeting"),
          description: args.description ? String(args.description) : undefined,
          participants: args.participants ? String(args.participants) : undefined,
          location: args.location ? String(args.location) : undefined,
          notes: args.notes ? String(args.notes) : undefined,
          createdBy: "TechForce AI",
        });
        return JSON.stringify({ success: true, appointmentId: id });
      }

      if (name === "create_job") {
        const id = await ctx.runMutation(api.jobs.create, {
          customerId: args.customerId as string,
          locationName: args.locationName ? String(args.locationName) : undefined,
          serviceType: String(args.serviceType ?? ""),
          scheduledDate: String(args.scheduledDate ?? ""),
          scheduledTime: String(args.scheduledTime ?? ""),
          dueDate: args.dueDate ? String(args.dueDate) : undefined,
          priority: (args.priority as "low" | "medium" | "high") ?? "medium",
          revenue: typeof args.revenue === "number" ? args.revenue : 0,
          notes: args.notes ? String(args.notes) : undefined,
        });
        return JSON.stringify({ success: true, jobId: id });
      }

      if (name === "create_invoice") {
        const id = await ctx.runMutation(api.invoices.create, {
          customerId: args.customerId as string,
          lineItems: [{ service: String(args.serviceType ?? ""), quantity: 1, rate: Number(args.totalAmount ?? 0), total: Number(args.totalAmount ?? 0) }],
          totalAmount: Number(args.totalAmount ?? 0),
          status: "draft",
        });
        return JSON.stringify({ success: true, invoiceId: id });
      }

      return JSON.stringify({ error: "Unknown tool: " + name });
    }

    // Agentic loop — up to 5 iterations to handle tool calls
    let fullText = "";
    let loopCount = 0;

    while (loopCount < 5) {
      loopCount++;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 2048,
          messages: chatMessages,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${err}`);
      }

      const data = (await response.json()) as {
        choices: Array<{
          message: {
            role: string;
            content: string | null;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason: string;
        }>;
      };

      const choice = data.choices[0];
      if (!choice) break;

      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        chatMessages.push({
          role: "assistant",
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        });

        for (const tc of msg.tool_calls) {
          let toolArgs: Record<string, unknown> = {};
          try { toolArgs = JSON.parse(tc.function.arguments); } catch {}
          const result = await executeTool(tc.function.name, toolArgs);
          chatMessages.push({ role: "tool", content: result, tool_call_id: tc.id });
        }
        continue;
      }

      fullText = msg.content ?? "";
      break;
    }

    // Save assistant reply
    await ctx.runMutation(api.ai.saveMessage, {
      conversationId,
      role: "assistant",
      content: fullText,
    });

    return fullText;
  },
});
