import { getApps, initializeApp } from "firebase-admin/app";
import { createCommercialCommandCallables } from "./callables/CommercialCommandCallables.js";

const app = getApps()[0] ?? initializeApp();
const callables = createCommercialCommandCallables(app);

export const submitCommercialCommand = callables.submitCommercialCommand;
export const getCommercialCommandReceipt = callables.getCommercialCommandReceipt;
