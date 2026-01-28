import { Observable } from "../public/lib/observable.js";
import { remote_encode } from "../lib/bun/middleware/remote.js";

const encoder = new TextEncoder();

/**
 * @param {(request:Request) => boolean} authorization_fn
 * @param {number} heartBeatIntervalInMS
 * @returns {[(request:Request) => Response, (data:any) => void]}
 */
export default function (authorization_fn, heartBeatIntervalInMS) {
    const observable = new Observable();
    const default_heart_beat_interval = 10_000;
    return [
        (request) => {
            if (!authorization_fn(request)) return new Response("Unauthorized", { status: 401 });

            const stream = new ReadableStream({
                start(controller) {
                    // Send first packet immediately
                    controller.enqueue(encoder.encode("data:pong\n\n"));

                    // interval message called "heartbeat" or "pong" (from ping-pong) to prevent the connection from being disconnected due to being idle
                    const pong_interval = () => setInterval(() => controller.enqueue(encoder.encode("data:pong\n\n")), heartBeatIntervalInMS || default_heart_beat_interval);
                    let heart_beat_id = pong_interval();

                    const unsubscribe = observable.subscribe((data) => {
                        // reset pong interval to prevent unnecessary pong event when there is data to send back. It also makes all pong messages consistent
                        clearInterval(heart_beat_id);
                        heart_beat_id = pong_interval();
                        controller.enqueue(encoder.encode("data:" + remote_encode(data) + "\n\n"));
                    })

                    // Cleanup on disconnect
                    request.signal.addEventListener("abort", () => {
                        clearInterval(heart_beat_id);
                        controller.close()
                        unsubscribe();
                    });
                },

            });

            return new Response(stream, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"
                }
            });
        },
        observable.notify,
    ]
}
