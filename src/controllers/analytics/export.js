import ExcelJS from "exceljs";
import Order from "../../models/order.js";

export async function exportAnalytics(request, reply) {
  try {
    const { startDate, endDate } = request.query;

    // Prepare date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Current day boundaries (00:00 to 23:59:59.999)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Build matchStage with OR: (date in range) OR (date is today)
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.$or = [
        { createdAt: dateFilter }, // existing date range
        { createdAt: { $gte: todayStart, $lte: todayEnd } }, // today data
      ];
    } else {
      // If no startDate or endDate, just filter for today (if you want)
      // Or no filter at all if you want all data
      // Assuming you want all data including today, no filter:
      // To only get today if no filter, uncomment below:
      // matchStage.createdAt = { $gte: todayStart, $lte: todayEnd };
    }

    const rawOrders = await Order.find(matchStage)
      .populate("customer", "name phone")
      .populate("branch", "name")
      .select(
        "orderId createdAt totalPrice payment.method payment.status deliveryFee handlingFee savings status deliveryLocation deliveryAddress pickupLocation discount statusTimestamps slot"
      )
      .lean();

    const orderRows = rawOrders.map((order) => ({
      orderId: order.orderId,
      customerName: order.customer?.name || "N/A",
      customerPhone: order.customer?.phone || "N/A",
      branch: order.branch?.name || "N/A",

      slotId: order.slot?.id || "N/A",
      slotLabel: order.slot?.label || "N/A",
      slotStartTime: order.slot?.startTime || "N/A",
      slotEndTime: order.slot?.endTime || "N/A",
      slotDate: order.slot?.date || "N/A",

      createdAt: new Date(order.createdAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),

      confirmedAt: order.statusTimestamps?.confirmedAt
        ? new Date(order.statusTimestamps.confirmedAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "N/A",
      packedAt: order.statusTimestamps?.packedAt
        ? new Date(order.statusTimestamps.packedAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "N/A",
      arrivingAt: order.statusTimestamps?.arrivingAt
        ? new Date(order.statusTimestamps.arrivingAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "N/A",
      deliveredAt: order.statusTimestamps?.deliveredAt
        ? new Date(order.statusTimestamps.deliveredAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "N/A",
      cancelledAt: order.statusTimestamps?.cancelledAt
        ? new Date(order.statusTimestamps.cancelledAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        : "N/A",

      paymentMethod: order.payment?.method || "N/A",
      paymentStatus: order.payment?.status || "N/A",

      totalPrice: order.totalPrice || 0,
      deliveryFee: order.deliveryFee || 0,
      handlingFee: order.handlingFee || 0,
      savings: order.savings || 0,

      status: order.status || "N/A",

      deliveryLatitude: order.deliveryLocation?.latitude || "N/A",
      deliveryLongitude: order.deliveryLocation?.longitude || "N/A",
      deliveryAddress: order.deliveryAddress?.address || "N/A",

      pickupLatitude: order.pickupLocation?.latitude || "N/A",
      pickupLongitude: order.pickupLocation?.longitude || "N/A",
      pickupAddress: order.pickupLocation?.address || "N/A",

      discountType: order.discount?.type || "N/A",
      discountAmount: order.discount?.amt || "N/A",
    }));

    // Run all aggregations with this matchStage
    const [
      ordersByDay,
      ordersByMonth,
      ordersBySlot,
      ordersByPaymentMethod,
      sellerProductAggregation,
      branchStats,
    ] = await Promise.all([
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            totalOrders: { $sum: 1 },
            canceledOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
              },
            },
            totalRevenue: { $sum: "$totalPrice" },
            totalDeliveryFee: { $sum: { $ifNull: ["$deliveryFee", 0] } },
            totalHandlingFee: { $sum: { $ifNull: ["$handlingFee", 0] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            totalOrders: { $sum: 1 },
            canceledOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
              },
            },
            totalRevenue: { $sum: "$totalPrice" },
            totalDeliveryFee: { $sum: { $ifNull: ["$deliveryFee", 0] } },
            totalHandlingFee: { $sum: { $ifNull: ["$handlingFee", 0] } },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$slot.label",
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: "$totalPrice" },
            canceledOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$payment.method",
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: "$totalPrice" },
            canceledOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: matchStage },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        {
          $group: {
            _id: {
              seller: { $ifNull: ["$productDetails.seller", null] },
              product: { $ifNull: ["$productDetails._id", null] },
              productName: {
                $ifNull: ["$productDetails.name", "Unknown Product"],
              },
            },
            totalQuantitySold: { $sum: "$items.count" },
            totalRevenue: { $sum: "$items.itemTotal" },
          },
        },

        {
          $group: {
            _id: "$_id.seller",
            totalQuantitySold: { $sum: "$totalQuantitySold" },
            totalRevenue: { $sum: "$totalRevenue" },
            products: {
              $push: {
                productId: "$_id.product",
                productName: "$_id.productName",
                quantitySold: "$totalQuantitySold",
                revenue: "$totalRevenue",
              },
            },
          },
        },
        {
          $lookup: {
            from: "sellers",
            localField: "_id",
            foreignField: "_id",
            as: "sellerDetails",
          },
        },
        { $unwind: "$sellerDetails" },
        {
          $project: {
            _id: 0,
            sellerId: "$sellerDetails._id",
            sellerName: { $ifNull: ["$sellerDetails.name", "Unknown Seller"] },
            totalQuantitySold: 1,
            totalRevenue: 1,
            products: 1,
          },
        },
      ]),
      Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$branch",
            totalOrders: { $sum: 1 },
            canceledOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
              },
            },
            totalRevenue: { $sum: "$totalPrice" },
            totalDeliveryFee: { $sum: { $ifNull: ["$deliveryFee", 0] } },
            totalHandlingFee: { $sum: { $ifNull: ["$handlingFee", 0] } },
          },
        },
        {
          $lookup: {
            from: "branches",
            localField: "_id",
            foreignField: "_id",
            as: "branchDetails",
          },
        },
        { $unwind: "$branchDetails" },
        {
          $project: {
            _id: 0,
            branchId: "$branchDetails._id",
            branchName: "$branchDetails.name",
            totalOrders: 1,
            canceledOrders: 1,
            totalRevenue: 1,
            totalDeliveryFee: 1,
            totalHandlingFee: 1,
          },
        },
      ]),
    ]);

    // Create workbook
    const workbook = new ExcelJS.Workbook();

    // Helper function to add a worksheet and data
    const addSheet = (name, headers, rows) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = headers.map((header) => ({ header, key: header }));
      sheet.addRows(rows);
    };

    addSheet(
      "Orders Data",
      [
        "orderId",
        "customerName",
        "customerPhone",
        "branch",
        "slotId",
        "slotLabel",
        "slotStartTime",
        "slotEndTime",
        "slotDate",
        "createdAt",
        "confirmedAt",
        "packedAt",
        "arrivingAt",
        "deliveredAt",
        "cancelledAt",
        "paymentMethod",
        "paymentStatus",
        "totalPrice",
        "deliveryFee",
        "handlingFee",
        "savings",
        "status",
        "deliveryLatitude",
        "deliveryLongitude",
        "deliveryAddress",
        "pickupLatitude",
        "pickupLongitude",
        "pickupAddress",
        "discountType",
        "discountAmount",
      ],
      orderRows
    );

    // Add all sheets
    addSheet(
      "Orders by Day",
      [
        "year",
        "month",
        "day",
        "totalOrders",
        "canceledOrders",
        "totalRevenue",
        "totalDeliveryFee",
        "totalHandlingFee",
      ],
      ordersByDay.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        day: item._id.day,
        totalOrders: item.totalOrders,
        canceledOrders: item.canceledOrders,
        totalRevenue: item.totalRevenue,
        totalDeliveryFee: item.totalDeliveryFee,
        totalHandlingFee: item.totalHandlingFee,
      }))
    );

    addSheet(
      "Orders by Month",
      [
        "year",
        "month",
        "totalOrders",
        "canceledOrders",
        "totalRevenue",
        "totalDeliveryFee",
        "totalHandlingFee",
      ],
      ordersByMonth.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        totalOrders: item.totalOrders,
        canceledOrders: item.canceledOrders,
        totalRevenue: item.totalRevenue,
        totalDeliveryFee: item.totalDeliveryFee,
        totalHandlingFee: item.totalHandlingFee,
      }))
    );

    addSheet(
      "Orders by Slot",
      ["slot", "totalOrders", "canceledOrders", "totalRevenue"],
      ordersBySlot.map((item) => ({
        slot: item._id,
        totalOrders: item.totalOrders,
        canceledOrders: item.canceledOrders,
        totalRevenue: item.totalRevenue,
      }))
    );

    addSheet(
      "Orders by Payment",
      ["paymentMethod", "totalOrders", "canceledOrders", "totalRevenue"],
      ordersByPaymentMethod.map((item) => ({
        paymentMethod: item._id,
        totalOrders: item.totalOrders,
        canceledOrders: item.canceledOrders,
        totalRevenue: item.totalRevenue,
      }))
    );

    addSheet(
      "Branch Stats",
      [
        "branchName",
        "totalOrders",
        "canceledOrders",
        "totalRevenue",
        "totalDeliveryFee",
        "totalHandlingFee",
      ],
      branchStats
    );
    // Seller sales summary: total quantity and revenue per seller (simplified)
    const sellerSalesSummary = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.seller",
          totalQuantitySold: { $sum: "$items.count" },
          totalRevenue: { $sum: "$items.itemTotal" },
        },
      },
      {
        $lookup: {
          from: "sellers",
          localField: "_id",
          foreignField: "_id",
          as: "sellerDetails",
        },
      },
      { $unwind: "$sellerDetails" },
      {
        $project: {
          _id: 0,
          sellerId: "$sellerDetails._id",
          sellerName: "$sellerDetails.name",
          totalQuantitySold: 1,
          totalRevenue: 1,
        },
      },
    ]);

    // Branch sales summary: total orders, revenue, fees per branch (simplified)
    const branchSalesSummary = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$branch",
          totalOrders: { $sum: 1 },
          canceledOrders: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
          totalRevenue: { $sum: "$totalPrice" },
          totalDeliveryFee: { $sum: { $ifNull: ["$deliveryFee", 0] } },
          totalHandlingFee: { $sum: { $ifNull: ["$handlingFee", 0] } },
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "_id",
          as: "branchDetails",
        },
      },
      { $unwind: "$branchDetails" },
      {
        $project: {
          _id: 0,
          branchId: "$branchDetails._id",
          branchName: "$branchDetails.name",
          totalOrders: 1,
          canceledOrders: 1,
          totalRevenue: 1,
          totalDeliveryFee: 1,
          totalHandlingFee: 1,
        },
      },
    ]);

    // Seller Product Report: one row per product
    const sellerProductRows = [];
    sellerProductAggregation.forEach((seller) => {
      seller.products.forEach((product) => {
        sellerProductRows.push({
          sellerName: seller.sellerName,
          productName: product.productName,
          quantitySold: product.quantitySold,
          revenue: product.revenue,
        });
      });
    });
    // Add Seller Sales Summary sheet
    addSheet(
      "Seller Sales Summary",
      ["sellerName", "totalQuantitySold", "totalRevenue"],
      sellerSalesSummary.map((seller) => ({
        sellerName: seller.sellerName,
        totalQuantitySold: seller.totalQuantitySold,
        totalRevenue: seller.totalRevenue,
      }))
    );

    // Add Branch Sales Summary sheet
    addSheet(
      "Branch Sales Summary",
      [
        "branchName",
        "totalOrders",
        "canceledOrders",
        "totalRevenue",
        "totalDeliveryFee",
        "totalHandlingFee",
      ],
      branchSalesSummary.map((branch) => ({
        branchName: branch.branchName,
        totalOrders: branch.totalOrders,
        canceledOrders: branch.canceledOrders,
        totalRevenue: branch.totalRevenue,
        totalDeliveryFee: branch.totalDeliveryFee,
        totalHandlingFee: branch.totalHandlingFee,
      }))
    );

    addSheet(
      "Seller Products",
      ["sellerName", "productName", "quantitySold", "revenue"],
      sellerProductRows
    );

    // Write Excel file and send response
    const buffer = await workbook.xlsx.writeBuffer();

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
