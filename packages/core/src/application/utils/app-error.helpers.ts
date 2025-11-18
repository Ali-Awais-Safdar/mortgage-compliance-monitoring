import type { AppError } from "@/application/errors/app-error";

export function aggregateErrorsToInvalidResponse(
  errs: AppError | AppError[],
): AppError {
  const errorMessages = (Array.isArray(errs) ? errs : [errs])
    .map((e) => e.message ?? "Unknown error")
    .join("; ");

  return {
    kind: "InvalidResponseError",
    message: errorMessages,
  };
}

