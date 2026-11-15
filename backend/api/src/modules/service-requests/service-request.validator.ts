import { z } from "zod";
import {
  serviceRequestCreateSchema,
  serviceRequestFormSchema,
  type ServiceRequestCreate,
  type ServiceRequestForm,
} from "@liena/shared-schemas";

export { serviceRequestFormSchema };
export const requestCreateSchema = serviceRequestCreateSchema;

export type RequestCreate = ServiceRequestCreate;
export type ServiceRequestFormInput = ServiceRequestForm;

export const requestIdParamsSchema = z
  .object({ id: z.string().regex(/^[1-9]\d*$/) })
  .strict();

export type RequestIdParams = z.output<typeof requestIdParamsSchema>;
