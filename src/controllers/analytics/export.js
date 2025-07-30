import ExcelJS from "exceljs";
import Order from "../../models/order.js";

export default async function exportAnalytics(req, reply) {
  try {
    const { from, to } = req.query;

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    const orders = await Order.find({
      ...(from || to ? { createdAt: dateFilter } : {}),
    })
      .populate("customer")
      .populate("items.branch")
      .populate("items.product")
      .populate("deliveryPartner");

    const workbook = new ExcelJS.Workbook();

    // 1. Orders by Area
    const areaSheet = workbook.addWorksheet("Orders by Area");
    areaSheet.columns = [
      { header: "Area", key: "area", width: 30 },
      { header: "Total Orders", key: "count", width: 15 },
      { header: "Total Value", key: "value", width: 20 },
    ];

    const areaMap = new Map();
    for (const order of orders) {
      const area = order.customer?.address?.area || "Unknown";
      const existing = areaMap.get(area) || { count: 0, value: 0 };
      areaMap.set(area, {
        count: existing.count + 1,
        value: existing.value + (order.totalPrice || 0),
      });
    }
    areaMap.forEach((v, k) =>
      areaSheet.addRow({ area: k, count: v.count, value: v.value })
    );

    // 2. All Orders
    const allSheet = workbook.addWorksheet("All Orders");
    allSheet.columns = [
      { header: "Order ID", key: "orderId", width: 15 },
      { header: "Customer", key: "customer", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Delivery Charge", key: "delivery", width: 15 },
      { header: "Handling Charge", key: "handling", width: 15 },
      { header: "Total", key: "total", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];
    orders.forEach((o) =>
      allSheet.addRow({
        orderId: o.orderId,
        customer: o.customer?.name || "N/A",
        status: o.status,
        paymentMethod: o.payment?.method,
        delivery: o.deliveryCharge || 0,
        handling: o.handlingCharge || 0,
        total: o.totalPrice,
        createdAt: o.createdAt.toLocaleString(),
      })
    );

    // 3. Orders by Payment Method
    const paymentSheet = workbook.addWorksheet("Orders by Payment");
    paymentSheet.columns = [
      { header: "Payment Method", key: "method", width: 20 },
      { header: "Total Orders", key: "count", width: 15 },
      { header: "Total Value", key: "value", width: 20 },
    ];
    const paymentMap = new Map();
    for (const o of orders) {
      const method = o.payment?.method || "Unknown";
      const prev = paymentMap.get(method) || { count: 0, value: 0 };
      paymentMap.set(method, {
        count: prev.count + 1,
        value: prev.value + (o.totalPrice || 0),
      });
    }
    paymentMap.forEach((v, k) =>
      paymentSheet.addRow({ method: k, count: v.count, value: v.value })
    );

    // 4. Order Items by Seller
    const sellerSheet = workbook.addWorksheet("Order Items by Seller");
    sellerSheet.columns = [
      { header: "Seller", key: "seller", width: 20 },
      { header: "Item", key: "name", width: 25 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Unit", key: "unit", width: 10 },
      { header: "Price", key: "price", width: 15 },
      { header: "Purchase Price", key: "purchasePrice", width: 15 },
      { header: "Total", key: "total", width: 15 },
    ];
    for (const o of orders) {
      for (const item of o.items || []) {
        const product = item.product;
        const variant = product?.variants?.find(
          (v) => v._id.toString() === item.variantId.toString()
        );
        sellerSheet.addRow({
          seller: product?.seller || "N/A",
          name: item.name,
          qty: item.count,
          unit: item.unit,
          price: item.price,
          purchasePrice: variant?.purchasePrice || "N/A",
          total: item.itemTotal,
        });
      }
    }

    // 5. Order Items by Seller + Branch
    const sellerBranchSheet = workbook.addWorksheet("Seller + Branch Items");
    sellerBranchSheet.columns = [
      { header: "Seller", key: "seller", width: 20 },
      { header: "Branch", key: "branch", width: 20 },
      { header: "Item", key: "name", width: 25 },
      { header: "Qty", key: "qty", width: 10 },
      { header: "Price", key: "price", width: 15 },
      { header: "Purchase Price", key: "purchasePrice", width: 15 },
      { header: "Total", key: "total", width: 15 },
    ];
    for (const o of orders) {
      for (const item of o.items || []) {
        const product = item.product;
        const variant = product?.variants?.find(
          (v) => v._id.toString() === item.variantId.toString()
        );
        sellerBranchSheet.addRow({
          seller: product?.seller || "N/A",
          branch: item.branch?.name || "N/A",
          name: item.name,
          qty: item.count,
          price: item.price,
          purchasePrice: variant?.purchasePrice || "N/A",
          total: item.itemTotal,
        });
      }
    }

    // Send workbook
    const buffer = await workbook.xlsx.writeBuffer();
    // ✅ Send and return immediately
    return reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      .header("Content-Disposition", "attachment; filename=analytics.xlsx")
      .send(buffer);
  } catch (error) {
    console.error("Export analytics error:", error);
    if (!reply.sent) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  }
}
