import { Router } from "express";
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type AIChatMessage = Parameters<typeof import("@workspace/integrations-openai-ai-server").openai.chat.completions.create>[0]["messages"][number];
import { db } from "@workspace/db";
import { conversations, messages, appointments } from "@workspace/db/schema";
import { jobsTable as jobs, customersTable as customers, employeesTable as employees, invoicesTable as invoices, customerLocationsTable } from "@workspace/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const SYSTEM_PROMPT = `You are TechForce AI — an intelligent assistant for Multicorp Fire Protection Services, a commercial fire protection company based in Columbia, MD. You act as a personalized secretary for managers and supervisors.

You help with:
- Scheduling and managing appointments (meetings, site visits, calls)
- Creating jobs and work orders for customers at specific locations
- Generating service estimates and quotes
- Creating and managing invoices
- Looking up customer, employee, and job information by customer or location
- Answering questions about the business

Company info:
- Name: Multicorp Fire Protection Services
- Address: 9693 Gerwig Lane, Columbia MD 21046
- Phone: (410) 876-5000
- Services: Sprinkler inspection, Suppression inspection, Extinguisher inspection, Fire alarm inspection

Customer & Location model:
- Each customer can have MULTIPLE service locations (e.g. a restaurant chain with multiple branches, a school with several buildings, a facility with a main office and an annex).
- When creating a job, always ask which specific location the job is for if the customer has multiple locations.
- Jobs are tracked per customer AND per location so service history is organized by site.
- When a user mentions a customer address or building name, treat it as a location within that customer account.

When creating appointments, jobs, or invoices, always confirm the action with the user and summarize what you created.

When a user asks you to do something, use the available tools/functions to take real action — don't just describe what to do.

Be concise, professional, and proactive. If you're missing information to complete a task, ask for just what you need.`;

const TOOLS: Parameters<typeof openai.chat.completions.create>[0]["tools"] = [
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
          status: { type: "string", description: "Filter by status: scheduled, in_progress, completed, cancelled" },
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
          title: { type: "string", description: "Title of the appointment" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          startTime: { type: "string", description: "Start time in HH:MM format (24h)" },
          endTime: { type: "string", description: "End time in HH:MM format (24h)" },
          type: { type: "string", enum: ["meeting", "site-visit", "call", "internal", "other"] },
          description: { type: "string" },
          participants: { type: "string", description: "Comma-separated list of participants" },
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
      description: "Create a new job/work order for a customer at a specific location",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "integer", description: "Customer ID" },
          locationId: { type: "integer", description: "Location ID within the customer account (use list_customer_locations to find)" },
          locationName: { type: "string", description: "Name of the service location (e.g. 'Main Location', 'Building B')" },
          serviceType: { type: "string", description: "Service type: suppression, sprinkler, extinguisher, alarm, etc." },
          scheduledDate: { type: "string", description: "Date in YYYY-MM-DD format" },
          scheduledTime: { type: "string", description: "Time in HH:MM format" },
          dueDate: { type: "string", description: "Due date / deadline in YYYY-MM-DD format (optional)" },
          employeeId: { type: "integer", description: "Employee ID to assign (optional)" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Job priority (default: medium)" },
          revenue: { type: "number", description: "Job revenue amount" },
          notes: { type: "string" },
        },
        required: ["customerId", "serviceType", "scheduledDate", "scheduledTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_customer_locations",
      description: "List all service locations for a specific customer",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "integer", description: "Customer ID to list locations for" },
        },
        required: ["customerId"],
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
          customerId: { type: "integer" },
          serviceType: { type: "string" },
          totalAmount: { type: "number" },
          notes: { type: "string" },
        },
        required: ["customerId", "serviceType", "totalAmount"],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    if (name === "list_customers") {
      const rows = await db.select().from(customers).where(eq(customers.isActive, true)).limit(20);
      return JSON.stringify(rows.map(c => ({ id: c.id, name: c.name, address: c.address, contactName: c.contactName, contactPhone: c.contactPhone })));
    }

    if (name === "list_employees") {
      const rows = await db.select().from(employees).where(eq(employees.isActive, true)).limit(20);
      return JSON.stringify(rows.map(e => ({ id: e.id, name: e.name, role: e.role, certifications: e.certifications })));
    }

    if (name === "list_jobs") {
      const rows = await db.select().from(jobs).orderBy(desc(jobs.scheduledDate)).limit(15);
      return JSON.stringify(rows.map(j => ({ id: j.id, customerId: j.customerId, serviceType: j.serviceType, status: j.status, scheduledDate: j.scheduledDate, scheduledTime: j.scheduledTime, revenue: j.revenue })));
    }

    if (name === "list_appointments") {
      const rows = await db.select().from(appointments).orderBy(asc(appointments.date), asc(appointments.startTime)).limit(20);
      return JSON.stringify(rows);
    }

    if (name === "create_appointment") {
      const {
        title, date, startTime, endTime, type, description, participants, location, notes,
      } = args as { title: string; date: string; startTime: string; endTime?: string; type: string; description?: string; participants?: string; location?: string; notes?: string };
      const [created] = await db.insert(appointments).values({
        title, date, startTime, endTime: endTime ?? null, type: type as "meeting" | "site-visit" | "call" | "internal" | "other",
        description: description ?? null, participants: participants ?? null, location: location ?? null, notes: notes ?? null,
        createdBy: "AI Assistant",
      }).returning();
      return JSON.stringify({ success: true, appointment: created });
    }

    if (name === "list_customer_locations") {
      const { customerId } = args as { customerId: number };
      const locs = await db.select().from(customerLocationsTable).where(eq(customerLocationsTable.customerId, customerId));
      return JSON.stringify(locs.map(l => ({ id: l.id, name: l.name, address: l.address, isPrimary: l.isPrimary, contactName: l.contactName })));
    }

    if (name === "create_job") {
      const { customerId, locationId, locationName, serviceType, scheduledDate, scheduledTime, dueDate, employeeId, priority, revenue, notes } = args as {
        customerId: number; locationId?: number; locationName?: string; serviceType: string;
        scheduledDate: string; scheduledTime: string; dueDate?: string;
        employeeId?: number; priority?: string; revenue?: number; notes?: string;
      };
      const [created] = await db.insert(jobs).values({
        customerId, serviceType,
        locationId: locationId ?? null,
        locationName: locationName ?? null,
        scheduledDate: scheduledDate ?? null,
        scheduledTime: scheduledTime ?? null,
        dueDate: dueDate ?? null,
        employeeId: employeeId ?? null,
        status: "scheduled",
        priority: (priority as "low" | "medium" | "high") ?? "medium",
        revenue: String(revenue ?? 0), quantity: 1,
        notes: notes ?? null, certificationRequired: "any",
        requiresFollowUp: false, followUpConfirmed: false,
      }).returning();
      return JSON.stringify({ success: true, job: { id: created.id, customerId, locationId: created.locationId, locationName: created.locationName, serviceType, scheduledDate, scheduledTime } });
    }

    if (name === "create_invoice") {
      const { customerId, serviceType, totalAmount } = args as {
        customerId: number; serviceType: string; totalAmount: number;
      };
      const count = await db.select().from(invoices);
      const invNumber = `INV-${new Date().getFullYear()}-${String(count.length + 1).padStart(3, "0")}`;
      const [created] = await db.insert(invoices).values({
        invoiceNumber: invNumber,
        customerId,
        jobId: null, techId: null,
        lineItems: [{ service: serviceType, quantity: 1, rate: totalAmount, total: totalAmount }],
        totalAmount: String(totalAmount),
        status: "draft",
      }).returning();
      return JSON.stringify({ success: true, invoice: { id: created.id, invoiceNumber: invNumber, customerId, totalAmount, status: "draft" } });
    }

    return JSON.stringify({ error: "Unknown tool" });
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

// ─── Stateless chat (used by frontend on both Replit and Vercel) ─────────────

router.post("/chat", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const { messages } = req.body as { messages: Array<{ role: string; content: string }> };
    if (!Array.isArray(messages)) {
      res.write(`data: ${JSON.stringify({ error: "Invalid request" })}\n\n`);
      res.end();
      return;
    }

    const chatMessages: AIChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    let loopCount = 0;
    let fullText = "";

    while (loopCount < 5) {
      loopCount++;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2048,
        messages: chatMessages,
        tools: TOOLS,
        stream: false,
      });

      const choice = completion.choices[0];
      if (!choice) break;
      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        chatMessages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls as ToolCall[] });
        for (const tc of msg.tool_calls) {
          const fn = (tc as { id: string; function: { name: string; arguments: string } }).function;
          let toolArgs: Record<string, unknown> = {};
          try { toolArgs = JSON.parse(fn.arguments); } catch { /* ignore */ }
          const toolResult = await executeTool(fn.name, toolArgs);
          chatMessages.push({ role: "tool", content: toolResult, tool_call_id: tc.id });
        }
        continue;
      }

      fullText = msg.content ?? "";
      break;
    }

    const words = fullText.split(" ");
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? "" : " ") + words[i];
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      await new Promise(r => setTimeout(r, 12));
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err, "OpenAI /chat error");
    res.write(`data: ${JSON.stringify({ error: "AI assistant error. Please try again." })}\n\n`);
    res.end();
  }
});

const CreateConvBody = z.object({ title: z.string().min(1) });
const SendMsgBody = z.object({ content: z.string().min(1) });

router.get("/openai/conversations", async (req, res) => {
  try {
    return res.json(await q("ai:listConversations"));
  } catch (err) {
    req.log.error(err, "Failed to list conversations");
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/openai/conversations", async (req, res) => {
  try {
    const title = String(req.body?.title ?? "New Conversation");
    const id = await m("ai:createConversation", { title });
    return res.status(201).json({ _id: id, title });
  } catch (err) {
    req.log.error(err, "Failed to create conversation");
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  try {
    return res.json(await q("ai:getMessages", { conversationId: asId(req.params.id) }));
  } catch (err) {
    req.log.error(err, "Failed to list messages");
    return res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const conversationId = asId(req.params.id);
  const content = String(req.body?.content ?? "").trim();
  if (!content) return res.status(400).json({ error: "content is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const { content } = SendMsgBody.parse(req.body);

    await db.insert(messages).values({ conversationId: convId, role: "user", content });

    const history = await db.select().from(messages).where(eq(messages.conversationId, convId)).orderBy(asc(messages.createdAt));

    const chatMessages: AIChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    let loopCount = 0;
    let fullText = "";

    while (loopCount < 5) {
      loopCount++;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2048,
        messages: chatMessages,
        tools: TOOLS,
        stream: false,
      });

      const choice = completion.choices[0];
      if (!choice) break;

      const msg = choice.message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        chatMessages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls as ToolCall[] });

        for (const tc of msg.tool_calls) {
          const fn = (tc as { id: string; function: { name: string; arguments: string } }).function;
          let toolArgs: Record<string, unknown> = {};
          try { toolArgs = JSON.parse(fn.arguments); } catch {}
          const toolResult = await executeTool(fn.name, toolArgs);
          chatMessages.push({ role: "tool", content: toolResult, tool_call_id: tc.id });
        }
        continue;
      }

      fullText = msg.content ?? "";
      break;
    }

    await db.insert(messages).values({ conversationId: convId, role: "assistant", content: fullText });

    const words = fullText.split(" ");
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? "" : " ") + words[i];
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    return res.end();
  } catch (err) {
    req.log.error(err, "OpenAI chat error");
    res.write(`data: ${JSON.stringify({ error: "AI assistant error. Please try again." })}\n\n`);
    return res.end();
  }
});

export default router;
