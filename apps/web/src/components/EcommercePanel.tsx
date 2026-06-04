"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function EcommercePanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "products" | "inventory" | "orders" | "customers">("products");
  
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  
  const defaultProduct = { name: "", description: "", price: "", stockQuantity: "", category: "General", imageUrl: "", sku: "" };
  const [productForm, setProductForm] = useState(defaultProduct);

  const fetchEcommerceData = async () => {
    setLoading(true);
    try {
      const [pRes, oRes, cRes] = await Promise.all([
        fetch("/api/v1/ecommerce/products", { headers: { "X-Org-Id": user?.orgName || "default_org" } }),
        fetch("/api/v1/ecommerce/orders", { headers: { "X-Org-Id": user?.orgName || "default_org" } }),
        fetch("/api/v1/ecommerce/customers", { headers: { "X-Org-Id": user?.orgName || "default_org" } })
      ]);
      const pData = await pRes.json();
      const oData = await oRes.json();
      const cData = await cRes.json();
      
      setProducts(pData.products || []);
      setOrders(oData.orders || []);
      setCustomers(cData.customers || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchEcommerceData();
  }, [user]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.price) return;
    
    try {
      if (editingProduct) {
        await fetch("/api/v1/ecommerce/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
          body: JSON.stringify({ productId: editingProduct.id, ...productForm })
        });
      } else {
        await fetch("/api/v1/ecommerce/products", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
          body: JSON.stringify(productForm)
        });
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setProductForm(defaultProduct);
      fetchEcommerceData();
    } catch (e) { console.error(e); }
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      stockQuantity: product.stockQuantity,
      category: product.category || "",
      imageUrl: product.imageUrl || "",
      sku: product.sku || ""
    });
    setIsModalOpen(true);
  };

  const updateProductStatus = async (productId: string, status: string) => {
    try {
      await fetch("/api/v1/ecommerce/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ productId, status })
      });
      fetchEcommerceData();
    } catch (e) { console.error(e); }
  };

  const updateOrderStatus = async (orderId: string, status: string, paymentStatus: string) => {
    try {
      await fetch("/api/v1/ecommerce/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({ orderId, status, paymentStatus })
      });
      fetchEcommerceData();
    } catch (e) { console.error(e); }
  };

  const simulateOrder = async () => {
    if (products.length === 0) {
        alert("Please add a product first!");
        return;
    }
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const qty = Math.floor(Math.random() * 3) + 1;
    
    try {
      // Create a customer first
      const cRes = await fetch("/api/v1/ecommerce/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
          body: JSON.stringify({
              name: `Guest ${Math.floor(Math.random() * 1000)}`,
              email: `customer${Math.floor(Math.random() * 1000)}@example.com`
          })
      });
      const cData = await cRes.json();
      const customerId = cData.customer?.id;

      if (!customerId) throw new Error("Customer creation failed");

      const res = await fetch("/api/v1/ecommerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({
            customerId: customerId,
            items: [
                { productId: randomProduct.id, quantity: qty, priceAtPurchase: randomProduct.price }
            ]
        })
      });
      if (res.ok) {
        fetchEcommerceData();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-fade-in fade-in max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
            <span>🛒</span> eCommerce Engine
          </h2>
          <p className="text-[var(--text-secondary)] mt-1">Manage your complete storefront, inventory, and customers.</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 bg-[var(--bg-1)] p-1.5 rounded-xl border border-[var(--border)] w-fit">
        {[
          { id: "dashboard", label: "Dashboard", icon: "📊" },
          { id: "products", label: "Products", icon: "📦" },
          { id: "inventory", label: "Inventory", icon: "📋" },
          { id: "orders", label: "Orders", icon: "🚚" },
          { id: "customers", label: "Customers", icon: "👥" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-2)]"}`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)] animate-pulse">Loading Store Data...</div>
      ) : activeTab === "dashboard" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-6 rounded-2xl border border-[var(--border)]">
                <h3 className="text-[var(--text-secondary)] text-sm font-medium mb-2">Total Sales</h3>
                <div className="text-3xl font-bold text-[var(--text-primary)]">${orders.reduce((acc, o) => acc + Number(o.totalAmount), 0).toFixed(2)}</div>
            </div>
            <div className="glass p-6 rounded-2xl border border-[var(--border)]">
                <h3 className="text-[var(--text-secondary)] text-sm font-medium mb-2">Total Orders</h3>
                <div className="text-3xl font-bold text-[var(--text-primary)]">{orders.length}</div>
            </div>
            <div className="glass p-6 rounded-2xl border border-[var(--border)]">
                <h3 className="text-[var(--text-secondary)] text-sm font-medium mb-2">Customers</h3>
                <div className="text-3xl font-bold text-[var(--text-primary)]">{customers.length}</div>
            </div>
        </div>
      ) : activeTab === "products" ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Product Catalog</h3>
            <button onClick={() => { setEditingProduct(null); setProductForm(defaultProduct); setIsModalOpen(true); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
                + Add Product
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((p) => (
              <div key={p.id} className="glass rounded-xl border border-[var(--border)] overflow-hidden group hover:border-indigo-500/50 transition-colors">
                <div className="aspect-square bg-[var(--bg-2)] relative overflow-hidden flex items-center justify-center">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <span className="text-4xl">📦</span>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded shadow-sm ${p.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-[var(--text-primary)] truncate" title={p.name}>{p.name}</h4>
                    <span className="font-bold text-indigo-400">${Number(p.price).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 h-8">{p.description || "No description provided."}</p>
                  
                  <div className="flex justify-between items-center text-xs text-[var(--text-muted)] border-t border-[var(--border)] pt-3">
                    <span>SKU: {p.sku || "N/A"}</span>
                    <button onClick={() => openEditModal(p)} className="text-indigo-400 hover:text-indigo-300 font-medium">Edit</button>
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="col-span-full py-20 text-center text-[var(--text-muted)] glass rounded-xl border border-[var(--border)] border-dashed">
                No products found. Start building your catalog!
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "inventory" ? (
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-1)]">
                <h3 className="font-semibold text-[var(--text-primary)]">Stock Management</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                    <tr>
                    <th className="p-4 font-medium">Product / SKU</th>
                    <th className="p-4 font-medium">Category</th>
                    <th className="p-4 font-medium">Stock Level</th>
                    <th className="p-4 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                    {products.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-[var(--bg-2)] flex items-center justify-center overflow-hidden shrink-0">
                                {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : "📦"}
                            </div>
                            <div>
                                <div className="font-medium text-[var(--text-primary)]">{p.name}</div>
                                <div className="text-xs text-[var(--text-muted)]">SKU: {p.sku || "N/A"}</div>
                            </div>
                        </td>
                        <td className="p-4 text-[var(--text-secondary)]">{p.category}</td>
                        <td className="p-4">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${p.stockQuantity > 10 ? 'bg-emerald-500' : p.stockQuantity > 0 ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                                <span className="font-medium text-[var(--text-primary)]">{p.stockQuantity}</span>
                            </div>
                        </td>
                        <td className="p-4">
                            <select 
                            value={p.status}
                            onChange={(e) => updateProductStatus(p.id, e.target.value)}
                            className="bg-zinc-900 border border-zinc-700 text-xs rounded px-2 py-1.5 text-zinc-300 outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                            <option value="active">Active</option>
                            <option value="draft">Draft</option>
                            <option value="archived">Archived</option>
                            </select>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        </div>
      ) : activeTab === "customers" ? (
        <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-1)]">
                <h3 className="font-semibold text-[var(--text-primary)]">Customer Directory</h3>
                <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full">{customers.length} Total</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                    <tr>
                    <th className="p-4 font-medium">Customer ID</th>
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Email</th>
                    <th className="p-4 font-medium">Lifetime Spend</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                    {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                        <td className="p-4 font-mono text-xs text-[var(--text-secondary)]">{c.id}</td>
                        <td className="p-4 font-medium text-[var(--text-primary)]">{c.name}</td>
                        <td className="p-4 text-[var(--text-secondary)]">{c.email}</td>
                        <td className="p-4 font-semibold text-emerald-400">${Number(c.totalSpent).toFixed(2)}</td>
                    </tr>
                    ))}
                    {customers.length === 0 && (
                    <tr>
                        <td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No customers yet.</td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
        </div>
      ) : (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button onClick={simulateOrder} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700 flex items-center gap-2">
                    ⚡ Simulate Checkout
                </button>
            </div>
            <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-1)]">
                <h3 className="font-semibold text-[var(--text-primary)]">Recent Orders</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                        <tr>
                            <th className="p-4 font-medium">Order ID</th>
                            <th className="p-4 font-medium">Customer ID</th>
                            <th className="p-4 font-medium">Items</th>
                            <th className="p-4 font-medium">Total</th>
                            <th className="p-4 font-medium">Payment</th>
                            <th className="p-4 font-medium">Fulfillment</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                        {orders.map((o) => (
                            <tr key={o.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                            <td className="p-4 font-mono text-xs text-[var(--text-secondary)]">{o.id}</td>
                            <td className="p-4 text-[var(--text-primary)] font-medium text-xs font-mono">{o.customerId}</td>
                            <td className="p-4 text-xs text-[var(--text-muted)]">
                                {o.items?.map((i: any) => (
                                    <div key={i.id}>{i.quantity}x {i.productName}</div>
                                ))}
                            </td>
                            <td className="p-4 font-semibold text-indigo-400">${Number(o.totalAmount).toFixed(2)}</td>
                            <td className="p-4">
                                <select 
                                    value={o.paymentStatus}
                                    onChange={(e) => updateOrderStatus(o.id, o.status, e.target.value)}
                                    className={`text-xs rounded-full px-2 py-1 font-medium border-none outline-none appearance-none cursor-pointer ${o.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : o.paymentStatus === 'refunded' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}
                                >
                                    <option value="unpaid">UNPAID</option>
                                    <option value="paid">PAID</option>
                                    <option value="refunded">REFUNDED</option>
                                </select>
                            </td>
                            <td className="p-4">
                                <select 
                                    value={o.status}
                                    onChange={(e) => updateOrderStatus(o.id, e.target.value, o.paymentStatus)}
                                    className={`text-xs rounded-full px-2 py-1 font-medium border-none outline-none appearance-none cursor-pointer ${o.status === 'shipped' ? 'bg-emerald-500/20 text-emerald-400' : o.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}
                                >
                                    <option value="pending">PENDING</option>
                                    <option value="paid">PROCESSING</option>
                                    <option value="shipped">SHIPPED</option>
                                    <option value="cancelled">CANCELLED</option>
                                </select>
                            </td>
                            </tr>
                        ))}
                        {orders.length === 0 && (
                            <tr>
                            <td colSpan={6} className="p-8 text-center text-[var(--text-muted)]">No orders yet.</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* Product CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#121214] border border-[var(--border)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-1)]">
              <h3 className="font-semibold text-lg text-[var(--text-primary)]">{editingProduct ? "Edit Product" : "Add New Product"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-white transition-colors text-xl">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="productForm" onSubmit={handleSaveProduct} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Product Name *</label>
                            <input required type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="e.g. Mechanical Keyboard" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">SKU</label>
                            <input type="text" value={productForm.sku} onChange={e => setProductForm({...productForm, sku: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono" placeholder="e.g. KEY-MECH-01" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Price ($) *</label>
                                <input required type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="99.99" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Stock Quantity *</label>
                                <input required type="number" value={productForm.stockQuantity} onChange={e => setProductForm({...productForm, stockQuantity: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="100" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Category</label>
                            <input required type="text" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Electronics" />
                        </div>
                    </div>
                    <div className="space-y-4 flex flex-col">
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Image URL</label>
                            <input type="url" value={productForm.imageUrl} onChange={e => setProductForm({...productForm, imageUrl: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="https://example.com/image.jpg" />
                        </div>
                        <div className="flex-grow">
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Description</label>
                            <textarea value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} className="w-full h-32 bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none" placeholder="Detailed product description..."></textarea>
                        </div>
                    </div>
                </div>
              </form>
            </div>
            <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-1)] flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-white transition-colors">Cancel</button>
              <button type="submit" form="productForm" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
                {editingProduct ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
