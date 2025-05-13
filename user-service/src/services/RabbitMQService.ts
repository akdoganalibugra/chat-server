import * as amqp from "amqplib";
import { Connection, Channel, ConsumeMessage } from "amqplib";
import config from "../config/config";
import { User } from "../database";
import { ApiError } from "../utils";

class RabbitMQService {
  private requestQueue = "USER_DETAILS_REQUEST";
  private responseQueue = "USER_DETAILS_RESPONSE";
  private connection: any;
  private channel: any;

  constructor() {
    this.init();
  }

  async init() {
    // @ts-ignore: using any to bypass type mismatch in amqplib
    this.connection = await amqp.connect(config.msgBrokerURL!);
    // @ts-ignore: using any to bypass type mismatch in amqplib
    this.channel = await this.connection.createChannel();

    // Asserting queues ensures they exist
    await this.channel.assertQueue(this.requestQueue);
    await this.channel.assertQueue(this.responseQueue);

    // Start listening for messages on the request queue
    this.channel.consume(this.requestQueue, async (msg: any) => {
      if (msg && msg.content) {
        const { userId } = JSON.parse(msg.content.toString());
        const userDetails = await getUserDetails(userId);

        // Send the user details response
        this.channel.sendToQueue(
          this.responseQueue,
          Buffer.from(JSON.stringify(userDetails)),
          { correlationId: msg.properties.correlationId }
        );

        // Acknowledge the processed message
        this.channel.ack(msg);
      }
    });
  }
}

const getUserDetails = async (userId: string) => {
  const userDetails = await User.findById(userId).select("-password");
  if (!userDetails) {
    throw new ApiError(404, "User not found");
  }

  return userDetails;
};
export const rabbitMQService = new RabbitMQService();
