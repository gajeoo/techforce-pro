import {
  Box,
  ChevronDown,
  ChevronRight,
  Check,
  DollarSign,
  Edit2,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type Catalog,
  type CatalogProduct,
  initialCatalogs,
  loadCatalogs,
  saveCatalogs,
} from "@/lib/catalog";

// ─── Product row ─────────────────────────────────────────────────────────────

function ProductRow({
  product,
  onEdit,
  onDelete,
}: {
  product: CatalogProduct;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-muted/30 rounded-lg transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{product.name}</span>
          {product.sku && (
            <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
              {product.sku}
            </span>
          )}
        </div>
        {product.description && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{product.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {product.price !== undefined && product.price > 0 && (
          <span className="text-sm font-bold text-emerald-600">
            ${product.price.toFixed(2)}{product.unit ? `/${product.unit}` : ""}
          </span>
        )}
        {product.price === 0 && (
          <span className="text-xs text-muted-foreground italic">Custom price</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
          onClick={onEdit}
          title="Edit price"
        >
          <Edit2 className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          title="Delete item"
        >
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Inline edit row ─────────────────────────────────────────────────────────

function EditProductRow({
  product,
  onSave,
  onCancel,
}: {
  product: CatalogProduct;
  onSave: (updated: CatalogProduct) => void;
  onCancel: () => void;
}) {
  const [name, setName]   = useState(product.name);
  const [sku, setSku]     = useState(product.sku ?? "");
  const [price, setPrice] = useState(product.price?.toString() ?? "0");
  const [unit, setUnit]   = useState(product.unit ?? "ea");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      ...product,
      name: name.trim(),
      sku:  sku.trim() || undefined,
      price: price === "" ? 0 : Number(price),
      unit: unit.trim() || "ea",
    });
  }

  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-primary/5 rounded-lg border border-primary/20">
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <Input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name"
          className="text-xs h-7 col-span-2"
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        />
        <Input
          value={sku}
          onChange={e => setSku(e.target.value)}
          placeholder="SKU"
          className="text-xs h-7"
        />
        <div className="flex gap-1">
          <span className="flex items-center text-xs text-muted-foreground pl-1">$</span>
          <Input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0.00"
            className="text-xs h-7 flex-1"
            min={0}
            step={0.01}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
          />
          <Input
            value={unit}
            onChange={e => setUnit(e.target.value)}
            placeholder="ea"
            className="text-xs h-7 w-12"
          />
        </div>
      </div>
      <Button variant="ghost" size="icon" className="size-6 text-emerald-600 hover:text-emerald-700 shrink-0" onClick={handleSave}>
        <Check className="size-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground shrink-0" onClick={onCancel}>
        <X className="size-3" />
      </Button>
    </div>
  );
}

// ─── Catalog card ─────────────────────────────────────────────────────────────

function CatalogCard({
  catalog,
  isExpanded,
  editingProductId,
  onToggle,
  onAddProduct,
  onDeleteProduct,
  onDeleteCatalog,
  onEditProduct,
  onSaveProduct,
  onCancelEdit,
}: {
  catalog: Catalog;
  isExpanded: boolean;
  editingProductId: string | null;
  onToggle: () => void;
  onAddProduct: () => void;
  onDeleteProduct: (productId: string) => void;
  onDeleteCatalog: () => void;
  onEditProduct: (productId: string) => void;
  onSaveProduct: (updated: CatalogProduct) => void;
  onCancelEdit: () => void;
}) {
  return (
    <Card className={`transition-all ${isExpanded ? "ring-1 ring-primary/20" : ""}`}>
      <CardContent className="p-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors rounded-t-xl"
        >
          {isExpanded ? (
            <ChevronDown className="size-4 text-primary shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground shrink-0" />
          )}
          <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
            catalog.type === "product"
              ? "bg-blue-100 dark:bg-blue-900/30"
              : "bg-amber-100 dark:bg-amber-900/30"
          }`}>
            {catalog.type === "product"
              ? <Package className="size-4 text-blue-600 dark:text-blue-400" />
              : <Wrench  className="size-4 text-amber-600 dark:text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-sm">{catalog.name}</span>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {catalog.products.length} item{catalog.products.length !== 1 ? "s" : ""}
          </Badge>
        </button>

        {isExpanded && (
          <div className="border-t">
            <div className="px-4 py-2 space-y-0.5">
              {catalog.products.map(product =>
                editingProductId === product.id ? (
                  <EditProductRow
                    key={product.id}
                    product={product}
                    onSave={onSaveProduct}
                    onCancel={onCancelEdit}
                  />
                ) : (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onEdit={() => onEditProduct(product.id)}
                    onDelete={() => onDeleteProduct(product.id)}
                  />
                )
              )}
              {catalog.products.length === 0 && (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  No items yet. Add one below.
                </p>
              )}
            </div>
            <div className="px-4 py-2 border-t flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 text-primary hover:text-primary"
                onClick={onAddProduct}
              >
                <Plus className="size-3" /> Add Product
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={onDeleteCatalog}
              >
                <Trash2 className="size-3" /> Remove Catalog
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add Catalog form ─────────────────────────────────────────────────────────

function AddCatalogForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, type: "product" | "service") => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"product" | "service">("product");

  return (
    <Card className="border-primary/30 ring-1 ring-primary/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold">New Catalog</span>
          <Button variant="ghost" size="icon" className="size-6" onClick={onCancel}>
            <X className="size-3" />
          </Button>
        </div>
        <div className="flex gap-2 mb-3">
          {(["product", "service"] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 p-2 rounded-lg border text-xs font-medium transition-all ${
                type === t
                  ? t === "product"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700"
                    : "border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700"
                  : "hover:bg-muted/50"
              }`}
            >
              {t === "product"
                ? <Package className="size-4 mx-auto mb-1" />
                : <Wrench  className="size-4 mx-auto mb-1" />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <Input
          placeholder="Catalog name..."
          value={name}
          onChange={e => setName(e.target.value)}
          className="text-sm mb-3"
          autoFocus
          onKeyDown={e => { if (e.key === "Enter" && name.trim()) onAdd(name.trim(), type); }}
        />
        <Button
          size="sm"
          className="w-full"
          disabled={!name.trim()}
          onClick={() => onAdd(name.trim(), type)}
        >
          Create Catalog
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Add Product form ─────────────────────────────────────────────────────────

function AddProductForm({
  onAdd,
  onCancel,
}: {
  onAdd: (product: CatalogProduct) => void;
  onCancel: () => void;
}) {
  const [name,  setName]  = useState("");
  const [sku,   setSku]   = useState("");
  const [price, setPrice] = useState("");
  const [unit,  setUnit]  = useState("ea");

  return (
    <div className="border rounded-xl p-3 bg-muted/20 mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold">Add New Product</span>
        <Button variant="ghost" size="icon" className="size-5" onClick={onCancel}>
          <X className="size-3" />
        </Button>
      </div>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
        <Input
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="text-xs h-8 col-span-2"
          autoFocus
        />
        <Input
          placeholder="SKU"
          value={sku}
          onChange={e => setSku(e.target.value)}
          className="text-xs h-8"
        />
        <div className="flex gap-1">
          <Input
            placeholder="Price"
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="text-xs h-8 flex-1"
            min={0}
            step={0.01}
          />
          <Input
            placeholder="Unit"
            value={unit}
            onChange={e => setUnit(e.target.value)}
            className="text-xs h-8 w-14"
          />
        </div>
      </div>
      <Button
        size="sm"
        className="mt-2 text-xs"
        disabled={!name.trim()}
        onClick={() =>
          onAdd({
            id: `new-${Date.now()}`,
            name: name.trim(),
            sku:  sku.trim() || undefined,
            price: price ? Number(price) : 0,
            unit: unit.trim() || "ea",
          })
        }
      >
        Add
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CatalogPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>(() => loadCatalogs());
  const [search,        setSearch]        = useState("");
  const [typeFilter,    setTypeFilter]    = useState<"all" | "product" | "service">("all");
  const [expandedIds,   setExpandedIds]   = useState<Set<string>>(new Set());
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [addingProductTo, setAddingProductTo] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<{ catalogId: string; productId: string } | null>(null);

  // Persist to localStorage whenever catalogs change
  useEffect(() => {
    saveCatalogs(catalogs);
  }, [catalogs]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const addCatalog = useCallback((name: string, type: "product" | "service") => {
    setCatalogs(prev => [...prev, { id: `cat-new-${Date.now()}`, name, type, products: [] }]);
    setShowAddCatalog(false);
  }, []);

  const deleteCatalog = useCallback((id: string) => {
    setCatalogs(prev => prev.filter(c => c.id !== id));
    setExpandedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const addProduct = useCallback((catalogId: string, product: CatalogProduct) => {
    setCatalogs(prev => prev.map(c =>
      c.id === catalogId ? { ...c, products: [...c.products, product] } : c
    ));
    setAddingProductTo(null);
  }, []);

  const deleteProduct = useCallback((catalogId: string, productId: string) => {
    setCatalogs(prev => prev.map(c =>
      c.id === catalogId ? { ...c, products: c.products.filter(p => p.id !== productId) } : c
    ));
  }, []);

  const saveEditedProduct = useCallback((catalogId: string, updated: CatalogProduct) => {
    setCatalogs(prev => prev.map(c =>
      c.id === catalogId
        ? { ...c, products: c.products.map(p => p.id === updated.id ? updated : p) }
        : c
    ));
    setEditingKey(null);
  }, []);

  const resetToDefaults = useCallback(() => {
    if (!window.confirm("Reset the catalog to factory defaults? All custom changes will be lost.")) return;
    setCatalogs(initialCatalogs);
  }, []);

  const filtered = catalogs.filter(c => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.products.some(
          p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
        )
      );
    }
    return true;
  });

  const productCatalogs = filtered.filter(c => c.type === "product");
  const serviceCatalogs = filtered.filter(c => c.type === "service");
  const totalProducts   = catalogs.filter(c => c.type === "product").reduce((s, c) => s + c.products.length, 0);
  const totalServices   = catalogs.filter(c => c.type === "service").reduce((s, c) => s + c.products.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Box className="size-6 text-primary shrink-0" />
            Catalogs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage products &amp; services for invoicing — prices are saved automatically
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={resetToDefaults}
            title="Reset to factory defaults"
          >
            <RotateCcw className="size-3" /> Reset
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAddCatalog(true)}>
            <Plus className="size-3.5" /> New Catalog
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="size-4 text-blue-600 mx-auto mb-1" />
            <div className="text-xl font-extrabold">{catalogs.filter(c => c.type === "product").length}</div>
            <div className="text-xs text-muted-foreground">Product Catalogs</div>
            <div className="text-[10px] text-muted-foreground">{totalProducts} items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Wrench className="size-4 text-amber-600 mx-auto mb-1" />
            <div className="text-xl font-extrabold">{catalogs.filter(c => c.type === "service").length}</div>
            <div className="text-xs text-muted-foreground">Service Catalogs</div>
            <div className="text-[10px] text-muted-foreground">{totalServices} items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="size-4 text-emerald-600 mx-auto mb-1" />
            <div className="text-xl font-extrabold">{totalProducts + totalServices}</div>
            <div className="text-xs text-muted-foreground">Total Items</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search catalogs & products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "product", "service"] as const).map(f => (
            <Button
              key={f}
              variant={typeFilter === f ? "default" : "outline"}
              size="sm"
              className="text-xs capitalize"
              onClick={() => setTypeFilter(f)}
            >
              {f === "all" ? "All" : f === "product" ? (
                <><Package className="size-3 mr-1" /> Products</>
              ) : (
                <><Wrench className="size-3 mr-1" /> Services</>
              )}
            </Button>
          ))}
        </div>
      </div>

      {showAddCatalog && (
        <AddCatalogForm onAdd={addCatalog} onCancel={() => setShowAddCatalog(false)} />
      )}

      {/* Products section */}
      {(typeFilter === "all" || typeFilter === "product") && productCatalogs.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package className="size-3.5 text-blue-600" /> Products
          </h2>
          <div className="space-y-2">
            {productCatalogs.map(catalog => (
              <div key={catalog.id}>
                <CatalogCard
                  catalog={catalog}
                  isExpanded={expandedIds.has(catalog.id)}
                  editingProductId={editingKey?.catalogId === catalog.id ? editingKey.productId : null}
                  onToggle={() => toggleExpanded(catalog.id)}
                  onAddProduct={() => {
                    setExpandedIds(prev => new Set([...prev, catalog.id]));
                    setAddingProductTo(catalog.id);
                  }}
                  onDeleteProduct={pid => deleteProduct(catalog.id, pid)}
                  onDeleteCatalog={() => deleteCatalog(catalog.id)}
                  onEditProduct={pid => setEditingKey({ catalogId: catalog.id, productId: pid })}
                  onSaveProduct={updated => saveEditedProduct(catalog.id, updated)}
                  onCancelEdit={() => setEditingKey(null)}
                />
                {addingProductTo === catalog.id && (
                  <AddProductForm
                    onAdd={p => addProduct(catalog.id, p)}
                    onCancel={() => setAddingProductTo(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services section */}
      {(typeFilter === "all" || typeFilter === "service") && serviceCatalogs.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Wrench className="size-3.5 text-amber-600" /> Services
          </h2>
          <div className="space-y-2">
            {serviceCatalogs.map(catalog => (
              <div key={catalog.id}>
                <CatalogCard
                  catalog={catalog}
                  isExpanded={expandedIds.has(catalog.id)}
                  editingProductId={editingKey?.catalogId === catalog.id ? editingKey.productId : null}
                  onToggle={() => toggleExpanded(catalog.id)}
                  onAddProduct={() => {
                    setExpandedIds(prev => new Set([...prev, catalog.id]));
                    setAddingProductTo(catalog.id);
                  }}
                  onDeleteProduct={pid => deleteProduct(catalog.id, pid)}
                  onDeleteCatalog={() => deleteCatalog(catalog.id)}
                  onEditProduct={pid => setEditingKey({ catalogId: catalog.id, productId: pid })}
                  onSaveProduct={updated => saveEditedProduct(catalog.id, updated)}
                  onCancelEdit={() => setEditingKey(null)}
                />
                {addingProductTo === catalog.id && (
                  <AddProductForm
                    onAdd={p => addProduct(catalog.id, p)}
                    onCancel={() => setAddingProductTo(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? `No results for "${search}"` : "No catalogs yet."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
