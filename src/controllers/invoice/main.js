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
      .populate("customer")
      .populate("items.branch");

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

    const activeItems = order.items.filter(
      (item) => item.status !== "cancelled"
    );
    if (!activeItems.length) {
      return reply.code(400).send({ error: "No active items in order" });
    }

    const branch = activeItems[0].branch;
    const doc = initJsPDF();
    const M = S.margins;
    const F = S.fontSizes;
    const pageWidth = S.pageWidth;
    let y = 30;

    const rightCol = (label, value, offsetY = 0) => {
      doc
        .setFontSize(F.text)
        .text(label, pageWidth - M.right - 200, y + offsetY)
        .text(String(value || "N/A"), pageWidth - M.right - 100, y + offsetY);
    };

    // --- HEADER: Company Info ---

    const heading = "Surat's Mart";
    const headingWidth = doc.getTextWidth(heading);
    doc.setFontSize(F.title).text(heading, (pageWidth - headingWidth) / 2, y);

    doc.setFontSize(F.subtitle).text("TAX INVOICE", M.left, y);
    y += 20;

    doc
      .setFontSize(F.text)
      .text(`Invoice From: ${branch.name || "Surati's Mart"}`, M.left, y)
      .text(`Branch Address: ${branch.address || "N/A"}`, M.left, y + 14)
      .text(`GSTIN: ${branch.gstin || "N/A"}`, M.left, y + 28)
      .text(`FSSAI: ${branch.fssai || "N/A"}`, M.left, y + 42)
      .text(`PAN: ${branch.pan || "N/A"}`, M.left, y + 56);
    y += 80;

    doc.setFontSize(F.label).text("Invoice To:", M.left, y);
    y += 14;
    doc
      .setFontSize(F.text)
      .text(order.customer.name || "N/A", M.left, y)
      .text(`Phone: ${order.customer.phone}`, M.left, y + 14)
      .text(
        `${[
          order.customer.address?.houseNo,
          order.customer.address?.streetAddress,
          order.customer.address?.landmark,
          order.customer.address?.city,
          order.customer.address?.state,
          order.customer.address?.pinCode,
        ]
          .filter(Boolean)
          .join(", ")}`,
        M.left,
        y + 28,
        { maxWidth: 300 }
      );

    rightCol("Invoice No:", order.orderId, 0);
    rightCol(
      "Invoice Date:",
      new Date(order.createdAt).toLocaleDateString(),
      14
    );
    rightCol("Place of Supply:", branch.state || "Gujarat", 28);
    y += 60;

    // --- ITEMS TABLE HEADER ---
    const headers = [
      "Sr No",
      "Description",
      // "HSN/SAC",
      // "UOM",
      "Qty",
      "Rate",
      // "Tax%",
      "Total",
    ];
    const colWidths = [40, 300, 40, 60, 60];
    let x = M.left;
    headers.forEach((h, i) => {
      doc.setFontSize(F.label).text(h, x, y);
      x += colWidths[i];
    });
    y += 16;

    // --- ITEMS TABLE ROWS ---

    activeItems.forEach((item, index) => {
      const rate = item.price;
      const qty = item.count;
      const total = +(rate * qty).toFixed(2);
      // const hsn = item.hsn || "NA";
      // const taxRate = 0; // Or item.taxRate if available

      // grandTotal += total;
      x = M.left;
      const row = [
        index + 1,
        item.name || "N/A",
        // hsn,
        // "NOS",
        qty,
        formatCurrency(rate),
        // `${taxRate}%`,
        formatCurrency(total),
      ];

      row.forEach((cell, i) => {
        doc.setFontSize(F.text).text(String(cell), x, y);
        x += colWidths[i];
      });
      y += 16;
    });

    doc.setFontSize(F.text);
    const totalItems = activeItems.length;
    const totalQty = activeItems.reduce((sum, i) => sum + i.count, 0);

    y += 25;

    doc.text(`Total Items:`, M.left, y);
    doc.text(String(totalItems), M.left + 120, y);

    y += 14;
    doc.text(`Total Quantity:`, M.left, y);
    doc.text(String(totalQty), M.left + 120, y);

    // --- SUMMARY ON LEFT ---

    const subtotal = activeItems.reduce((sum, i) => sum + i.itemTotal, 0);
    const deliveryCharge = order.deliveryCharge || 0;
    const handlingCharge = order.handlingCharge || 0;
    const discount = order.discount?.amt ? parseFloat(order.discount.amt) : 0;
    const grandTotal = subtotal + deliveryCharge + handlingCharge - discount;

    y += 35;

    doc.setFont("helvetica", "bold").setFontSize(F.label);
    doc.text("Order Summary", M.left, y);
    y += 16;

    doc.setFont("helvetica", "normal").setFontSize(F.text);
    doc.text("Subtotal:", M.left, y);
    doc.text(formatCurrency(subtotal), M.left + 120, y, { align: "right" });

    y += 14;
    doc.text("Delivery Charge:", M.left, y);
    doc.text(formatCurrency(deliveryCharge), M.left + 120, y, {
      align: "right",
    });

    y += 14;
    doc.text("Handling Fee:", M.left, y);
    doc.text(formatCurrency(handlingCharge), M.left + 120, y, {
      align: "right",
    });

    if (discount > 0) {
      y += 14;
      doc.text("Discount:", M.left, y);
      doc.text("- " + formatCurrency(discount), M.left + 120, y, {
        align: "right",
      });
    }

    y += 16;
    doc.setFont("helvetica", "bold");
    doc.text("Invoice Value:", M.left, y);
    doc.text(formatCurrency(grandTotal), M.left + 120, y, { align: "right" });

    // // --- Amount in words ---
    // const inWords = `Amount in words: ${convertToWords(grandTotal)} only`;
    // doc.setFontSize(F.text).text(inWords, M.left, y);

    // --- Digital Signature Placeholder ---
    y += 50;
    doc
      .setFontSize(F.text)
      .text("Authorized Signature", pageWidth - M.right - 150, y);
    doc
      .setFontSize(F.text)
      .text(
        "Digitally signed by Surati's Mart",
        pageWidth - M.right - 180,
        y + 14
      );

    // --- Footer ---
    y += 40;
    doc
      .setFontSize(F.text)
      .text(
        "Thank you for shopping with us! Goods once sold will not be returned except in case of damage or expiry.",
        M.left,
        y,
        { maxWidth: pageWidth - 2 * M.left }
      );

    // Send PDF
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
