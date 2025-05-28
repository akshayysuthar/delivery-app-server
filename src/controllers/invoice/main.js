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
    right: 500,
  },
  pageWidth: 612, // A4 pt width approx
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
      .populate("branch");
    if (!order) {
      return reply.code(404).send({ error: "Order not found" });
    }

    const customer = order.customer;
    const branch = order.branch;

    const doc = initJsPDF();
    const M = S.margins;
    const F = S.fontSizes;
    const pageWidth = S.pageWidth;
    let y = 20;

    // --- COMPANY HEADER ---
    const company = {
      name: "My Company Pvt Ltd",
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
    doc.text(invoiceTitle, pageWidth - M.left - titleWidth, 34);

    doc.setFontSize(F.text);
    const orderIdText = `Order No: ${order.orderId}`;
    const orderDateText = `Date: ${new Date(
      order.createdAt
    ).toLocaleDateString()}`;

    const orderIdWidth = doc.getTextWidth(orderIdText);
    const orderDateWidth = doc.getTextWidth(orderDateText);

    doc.text(orderIdText, pageWidth - M.left - orderIdWidth, 52);
    doc.text(orderDateText, pageWidth - M.left - orderDateWidth, 68);

    // horizontal line
    doc.setLineWidth(0.5).line(M.left, 90, pageWidth - M.left, 90);

    // --- BRANCH INFO ---
    y = 110;
    doc.setFontSize(F.label).text("Branch:", M.left, y);
    doc
      .setFontSize(F.text)
      .text(branch.name, M.left + 60, y)
      .text(branch.address, M.left + 60, y + 14)
      .text(`Phone: ${branch.contactNumber}`, M.left + 60, y + 28)
      .text(`Type: ${branch.type}`, M.left + 60, y + 42)
      .text(
        `Hours: ${branch.operationalHours.open}–${branch.operationalHours.close}`,
        M.left + 60,
        y + 56
      );

    // --- CUSTOMER INFO ---
    y += 80;
    doc.setFontSize(F.label).text("Customer:", M.left, y);
    doc
      .setFontSize(F.text)
      .text(customer.name, M.left + 60, y)
      .text(`Phone: ${customer.phone}`, M.left + 60, y + 14)
      .text(
        `Address: ${[
          customer.address.houseNo,
          customer.address.streetAddress,
          customer.address.landmark,
          customer.address.city,
          customer.address.state,
          customer.address.pinCode,
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
      .text(`${order.slot.label} (${order.slot.date})`, M.left + 80, y);
    doc.setFontSize(F.label).text("Payment:", M.left + 300, y);
    doc
      .setFontSize(F.text)
      .text(
        `${order.payment.method} / ${order.payment.status}`,
        M.left + 360,
        y
      );

    // horizontal line
    doc.line(M.left, y + 20, pageWidth - M.left, y + 20);

    // --- ITEMS TABLE HEADER ---
    y += 40;
    const colItem = M.left;
    const colQty = 280;
    const colPrice = 390;
    const colTotal = 520;
    doc.setFontSize(F.label);
    doc.text("Item", colItem, y);
    doc.text("Qty", colQty, y, { align: "right" });
    doc.text("Price", colPrice, y, { align: "right" });
    doc.text("Total", colTotal, y, { align: "right" });

    // --- ITEMS ---
    y += 16;
    doc.setFontSize(F.text);
    let totalQty = 0;
    order.items.forEach((i) => {
      const lineTotal = i.count * i.price;
      totalQty += i.count;
      doc.text(i.name, colItem, y, { maxWidth: 250 });
      doc.text(String(i.count), colQty, y, { align: "right" });
      doc.text(formatCurrency(i.price), colPrice, y, { align: "right" });
      doc.text(formatCurrency(lineTotal), colTotal, y, { align: "right" });
      y += 16;
    });

    // free products
    if (order.freeProducts?.length) {
      order.freeProducts.forEach((i) => {
        doc.text(`${i.name} (Free)`, colItem, y, { maxWidth: 250 });
        doc.text(String(i.count), colQty, y, { align: "right" });
        doc.text("₹ 0.00", colPrice, y, { align: "right" });
        doc.text("₹ 0.00", colTotal, y, { align: "right" });
        y += 16;
      });
    }

    // separator line
    doc.line(M.left, y + 4, pageWidth - M.left, y + 4);

    // --- SUMMARY ---
    y += 20;
    const subtotal = order.items.reduce((sum, i) => sum + i.count * i.price, 0);
    const deliveryFee = order.deliveryFee || 0;
    const handlingFee = order.handlingFee || 0;
    const savings = order.savings || 0;
    const grandTotal = subtotal + deliveryFee + handlingFee - savings;

    doc.setFontSize(F.label);
    doc.text(`Total items:   ${totalQty}`, M.left, y);
    doc.text(formatCurrency(subtotal), colTotal, y, { align: "right" });

    y += 16;
    doc.text("Delivery:  ", colPrice, y);
    doc.text(formatCurrency(deliveryFee), colTotal, y, { align: "right" });

    y += 16;
    doc.text("Handling:  ", colPrice, y);
    doc.text(formatCurrency(handlingFee), colTotal, y, { align: "right" });

    y += 16;
    doc.text("Savings:  ", colPrice, y);
    doc.text(`- ${formatCurrency(savings)}`, colTotal, y, { align: "right" });

    y += 16;
    doc.setFontSize(F.subtitle);
    doc.text("Grand Total:  ", colPrice, y)
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
        { maxWidth: pageWidth - 2 * M.left }
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
