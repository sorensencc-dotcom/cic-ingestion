import { profileFirecracker } from "./firecracker-latency-profile";
import { profileOnnx } from "./onnx-latency-profile";
import { profileRouting } from "./routing-latency-profile";

export async function runStabilityCheck() {
  const firecracker = await profileFirecracker();
  const onnx = await profileOnnx();
  const routing = await profileRouting();

  return {
    firecracker,
    onnx,
    routing,
    passed:
      firecracker.cv < 0.10 &&
      onnx.cv < 0.10 &&
      routing.cv < 0.10,
  };
}
