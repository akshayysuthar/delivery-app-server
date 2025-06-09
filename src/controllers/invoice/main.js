import { jsPDF } from "jspdf";
import { JSDOM } from "jsdom";
import Order from "../../models/order.js";
import Branch from "../../models/branch.js";

const S = {
  fontSizes: {
    title: 18,
    subtitle: 14,
    label: 12,
    text: 10,
  },
  margins: {
    left: 25,
    right: 25,
  },
  pageWidth: 612, // A4 pt width
};

function initJsPDF() {
  const dom = new JSDOM("<!doctype html><html><body/></html>");
  global.window = dom.window;
  global.document = dom.window.document;
  return new jsPDF({ unit: "pt", format: "a4" });
}

function formatCurrency(v) {
  return "₹ " + v.toFixed(2);
}

export default async function invoiceHandler(request, reply) {
  try {
    const { orderId } = request.params;
    const order = await Order.findById(orderId)
      .lean()
      .populate("customer")
      .populate("items.branch"); // Populate items.branch
    if (
      !order ||
      !order.customer ||
      !order.items?.length ||
      !order.items[0].branch
    ) {
      return reply
        .code(404)
        .send({ error: "Order, customer, items, or branch not found" });
    }

    // Filter out cancelled items
    const activeItems = order.items.filter(
      (item) => item.status !== "cancelled"
    );
    if (!activeItems.length) {
      return reply.code(400).send({ error: "No active items in order" });
    }

    // Use the branch from the first active item
    const branch = activeItems[0].branch;

    // Validate that all active items have the same branch
    const allSameBranch = activeItems.every(
      (item) => item.branch._id.toString() === branch._id.toString()
    );
    if (!allSameBranch) {
      console.warn(
        "Warning: Order contains items from multiple branches. Using first active item's branch for invoice."
      );
    }

    const doc = initJsPDF();
    const M = S.margins;
    const F = S.fontSizes;
    const pageWidth = S.pageWidth;
    let y = 20;

    // --- COMPANY HEADER ---
    const company = {
      name: "Surati's Mart",
      address: "123 Business St, City",
      phone: "+1234567890",
      email: "contact@mycompany.com",
      supportPhone: "+19876543210",
      supportEmail: "support@mycompany.com",
    };
    doc.setFontSize(F.title).text(company.name, M.left, y);
    y += 16;
    doc
      .setFontSize(F.text)
      .text(company.address, M.left, y)
      .text(`Phone: ${company.phone}`, M.left, y + 14)
      .text(`Email: ${company.email}`, M.left, y + 28);

    // --- INVOICE TITLE & ORDER INFO (RIGHT ALIGNED) ---
    doc.setFontSize(F.title);
    const invoiceTitle = "INVOICE";
    const titleWidth = doc.getTextWidth(invoiceTitle);
    doc.text(invoiceTitle, pageWidth - M.right - titleWidth, 34);

    doc.setFontSize(F.text);
    const orderIdText = `Order No: ${order.orderId}`;
    const orderDateText = `Date: ${
      order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "N/A"
    }`;
    const orderStatusText = `Status: ${order.status || "N/A"}`;

    const orderIdWidth = doc.getTextWidth(orderIdText);
    const orderDateWidth = doc.getTextWidth(orderDateText);
    const orderStatusWidth = doc.getTextWidth(orderStatusText);

    doc.text(orderIdText, pageWidth - M.right - orderIdWidth, 52);
    doc.text(orderDateText, pageWidth - M.right - orderDateWidth, 68);
    doc.text(orderStatusText, pageWidth - M.right - orderStatusWidth, 84);

    // Horizontal line
    doc.setLineWidth(0.5).line(M.left, 90, pageWidth - M.right, 90);

    // --- BRANCH INFO ---
    y = 110;
    doc.setFontSize(F.label).text("Branch:", M.left, y);
    const branchAddress =
      order.pickupLocations?.[0]?.address || branch.address || "N/A";
    doc
      .setFontSize(F.text)
      .text(branch.name || "N/A", M.left + 60, y)
      .text(branchAddress, M.left + 60, y + 14)
      .text(`Phone: ${branch.contactNumber || "N/A"}`, M.left + 60, y + 28)
      .text(`Type: ${branch.type || "N/A"}`, M.left + 60, y + 42)
      .text(
        `Hours: ${branch.operationalHours?.open || "N/A"}–${
          branch.operationalHours?.close || "N/A"
        }`,
        M.left + 60,
        y + 56
      );

    // --- CUSTOMER INFO ---
    y += 80;
    doc.setFontSize(F.label).text("Customer:", M.left, y);
    doc
      .setFontSize(F.text)
      .text(order.customer.name || "N/A", M.left + 60, y)
      .text(`Phone: ${order.customer.phone || "N/A"}`, M.left + 60, y + 14)
      .text(
        `Address: ${[
          order.customer.address?.houseNo,
          order.customer.address?.streetAddress,
          order.customer.address?.landmark,
          order.customer.address?.city,
          order.customer.address?.state,
          order.customer.address?.pinCode,
          order.deliveryAddress?.address,
        ]
          .filter(Boolean)
          .join(", ")}`,
        M.left + 60,
        y + 28,
        { maxWidth: 300 }
      );

    // --- DELIVERY SLOT & PAYMENT ---
    y += 80;
    doc.setFontSize(F.label).text("Delivery Slot:", M.left, y);
    doc
      .setFontSize(F.text)
      .text(
        `${order.slot?.label || "N/A"} (${order.slot?.date || "N/A"})`,
        M.left + 80,
        y
      );
    doc.setFontSize(F.label).text("Payment:", M.left + 300, y);
    doc
      .setFontSize(F.text)
      .text(
        `${order.payment?.method || "N/A"} / ${order.payment?.status || "N/A"}`,
        M.left + 360,
        y
      );

    // Horizontal line
    doc.line(M.left, y + 20, pageWidth - M.right, y + 20);

    // --- ITEMS TABLE HEADER ---
    y += 40;
    const colItem = M.left;
    const colUnit = M.left + 200;
    const colQty = 280;
    const colPrice = 390;
    const colTotal = 520;
    doc.setFontSize(F.label);
    doc.text("Item", colItem, y);
    doc.text("Unit", colUnit, y);
    doc.text("Qty", colQty, y, { align: "right" });
    doc.text("Price", colPrice, y, { align: "right" });
    doc.text("Total", colTotal, y, { align: "right" });

    // --- ITEMS ---
    y += 16;
    doc.setFontSize(F.text);
    let totalQty = 0;
    const rowHeight = 16;
    const bottomMargin = 60; // Space to leave at bottom for summary/footer

    activeItems.forEach((i, idx) => {
      // Check if we need a new page
      if (y + rowHeight + bottomMargin > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        y = 40; // Reset y for new page, adjust as needed

        // Redraw table header on new page
        doc.setFontSize(F.label);
        doc.text("Item", colItem, y);
        doc.text("Unit", colUnit, y);
        doc.text("Qty", colQty, y, { align: "right" });
        doc.text("Price", colPrice, y, { align: "right" });
        doc.text("Total", colTotal, y, { align: "right" });
        y += rowHeight;
        doc.setFontSize(F.text);
      }

      totalQty += i.count;
      doc.text(i.name || "N/A", colItem, y, { maxWidth: 180 });
      doc.text(i.unit || "N/A", colUnit, y);
      doc.text(String(i.count), colQty, y, { align: "right" });
      doc.text(formatCurrency(i.price), colPrice, y, { align: "right" });
      doc.text(formatCurrency(i.itemTotal), colTotal, y, { align: "right" });
      y += rowHeight;
    });

    // Separator line
    doc.line(M.left, y + 4, pageWidth - M.right, y + 4);

    // --- SUMMARY ---
    y += 20;
    const subtotal = activeItems.reduce((sum, i) => sum + i.itemTotal, 0);
    const deliveryCharge = order.deliveryCharge || 0;
    const handlingCharge = order.handlingCharge || 0;
    const discount = order.discount?.amt ? parseFloat(order.discount.amt) : 0;
    const grandTotal = subtotal + deliveryCharge + handlingCharge - discount;

    doc.setFontSize(F.label);
    doc.text(`Total items: ${totalQty}`, M.left, y);
    doc.text(formatCurrency(subtotal), colTotal, y, { align: "right" });

    y += 16;
    doc.text("Delivery: ", colPrice, y);
    doc.text(formatCurrency(deliveryCharge), colTotal, y, { align: "right" });

    y += 16;
    doc.text("Handling: ", colPrice, y);
    doc.text(formatCurrency(handlingCharge), colTotal, y, { align: "right" });

    if (discount > 0) {
      y += 16;
      doc.text(`Discount (${order.discount?.type || "N/A"}): `, colPrice, y);
      doc.text(`- ${formatCurrency(discount)}`, colTotal, y, {
        align: "right",
      });
    }

    y += 16;
    doc.setFontSize(F.subtitle);
    doc.text("Grand Total: ", colPrice, y);
    doc.text(formatCurrency(grandTotal), colTotal, y, { align: "right" });

    // --- CUSTOMER SUPPORT INFO ---
    y += 40;
    doc.setFontSize(F.label).text("Customer Support:", M.left, y);
    y += 14;
    doc
      .setFontSize(F.text)
      .text(`Phone: ${company.supportPhone}`, M.left, y)
      .text(`Email: ${company.supportEmail}`, M.left, y + 14);

    // --- FOOTER NOTE ---
    y += 50;
    doc
      .setFontSize(F.text)
      .text(
        "Thank you for your business! Goods once sold cannot be returned except in case of damage.",
        M.left,
        y,
        { maxWidth: pageWidth - 2 * M.right }
      );

    // SEND PDF
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    return reply
      .header("Content-Type", "application/pdf")
      .header(
        "Content-Disposition",
        `attachment; filename=invoice_${order.orderId}.pdf`
      )
      .send(pdfBuffer);
  } catch (err) {
    console.error("Invoice generation error:", err);
    if (!reply.sent) {
      return reply.code(500).send({ error: "Failed to generate invoice" });
    }
  }
}
