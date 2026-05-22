"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function EcommercePanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState({ name: "", description: "", price: "", stockQuantity: "", category: "General" });

  const fetchEcommerceData = async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        fetch("/api/v1/ecommerce/products", { headers: { "X-Org-Id": user?.orgName || "default_org" } }),
        fetch("/api/v1/ecommerce/orders", { headers: { "X-Org-Id": user?.orgName || "default_org" } })
      ]);
      const pData = await pRes.json();
      const oData = await oRes.json();
      setProducts(pData.products || []);
      setOrders(oData.orders || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchEcommerceData();
  }, [user]);

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) return;
    try {
      const res = await fetch("/api/v1/ecommerce/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify(newProduct)
      });
      if (res.ok) {
        setNewProduct({ name: "", description: "", price: "", stockQuantity: "", category: "General" });
        fetchEcommerceData();
      }
    } catch (e) { console.error(e); }
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
      const res = await fetch("/api/v1/ecommerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Org-Id": user?.orgName || "default_org" },
        body: JSON.stringify({
            customerEmail: `customer${Math.floor(Math.random() * 1000)}@example.com`,
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
          <p className="text-[var(--text-secondary)] mt-1">Manage your product catalog and monitor incoming sales.</p>
        </div>
        <div className="flex gap-2 bg-[var(--bg-1)] p-1 rounded-xl border border-[var(--border)]">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "products" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            Product Catalog
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "orders" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            Order Fulfillment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--text-muted)] animate-pulse">Loading Store Data...</div>
      ) : activeTab === "products" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-1)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Inventory</h3>
              <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full">{products.length} Products</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-2)] text-[var(--text-muted)]">
                  <tr>
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium">Price</th>
                    <th className="p-4 font-medium">Stock</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--bg-1)]/50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-[var(--text-primary)]">{p.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">{p.category}</div>
                      </td>
                      <td className="p-4 text-[var(--text-secondary)]">${Number(p.price).toFixed(2)}</td>
                      <td className="p-4">
                         <span className={`text-xs px-2 py-1 rounded-full ${p.stockQuantity > 10 ? 'bg-emerald-500/10 text-emerald-500' : p.stockQuantity > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                            {p.stockQuantity} in stock
                         </span>
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
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No products in catalog. Add one to start selling!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-2xl border border-[var(--border)] p-6 h-fit sticky top-6">
            <h3 className="font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2">
              <span className="text-indigo-400">📦</span> Add Product
            </h3>
            <form onSubmit={addProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Product Name</label>
                <input required type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Pro Subscription" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Price ($)</label>
                    <input required type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="99.99" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Stock</label>
                    <input required type="number" value={newProduct.stockQuantity} onChange={e => setNewProduct({...newProduct, stockQuantity: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Category</label>
                <input required type="text" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Software" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-sm font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-indigo-500/20 mt-2">
                Save Product
              </button>
            </form>
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
                            <th className="p-4 font-medium">Customer</th>
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
                            <td className="p-4 text-[var(--text-primary)] font-medium">{o.customerEmail}</td>
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
    </div>
  );
}
