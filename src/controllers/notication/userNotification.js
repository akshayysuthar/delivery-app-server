import { Customer, Order, user } from "../../models";
import { sendNotification } from "./fcmService";

async function updateOrderStatus(orderId, newStatus) {
  const order = await Order.findByIdAndUpdate(
    orderId,
    { status: newStatus },
    { new: true }
  );

  // Find customer FCM token
  const user = await Customer.findById(order.customer);
  if (user?.fcmToken) {
    await sendNotification(
      user.fcmToken,
      "Order Update",
      `Your order is now ${newStatus}.`
    );
  }

  return order;
}
