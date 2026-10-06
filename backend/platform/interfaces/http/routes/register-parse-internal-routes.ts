import { GET, POST, PUT, type RouteDefinition } from "eve/channels";
import {
  handleParseArtifactsBatch,
  handleParseFigureGet,
  handleParseFigurePut,
  handleParseOriginalFile,
  handleAsrFileDownload,
  handleAsrFilesMint,
  handleParseRunPayload,
  handleParseRunStatus,
  handleParseEmailDerived,
  handleParseWebhook,
} from "../parse-internal.handlers.js";
import type { PlatformRouteContext } from "../platform-route-context.js";

export function registerParseInternalRoutes(
  ctx: PlatformRouteContext,
): RouteDefinition[] {
  const { preflight, withCors } = ctx;

  return [
    preflight("/internal/parse/v1/webhook"),

    GET("/internal/parse/v1/run/:jobId", async (request, { params }) => {
      const response = await handleParseRunPayload(params.jobId, request);
      return withCors(response, request);
    }),

    POST("/internal/parse/v1/run/:jobId/status", async (request, { params }) => {
      const response = await handleParseRunStatus(params.jobId, request);
      return withCors(response, request);
    }),

    POST("/internal/parse/v1/run/:jobId/asr-files/mint", async (request, { params }) => {
      const response = await handleAsrFilesMint(params.jobId, request);
      return withCors(response, request);
    }),

    GET("/internal/parse/v1/asr-files/:attachmentId", async (request, { params }) => {
      const response = await handleAsrFileDownload(params.attachmentId, request);
      return withCors(response, request);
    }),

    GET("/internal/parse/v1/files/:attachmentId/original", async (request, { params }) => {
      const response = await handleParseOriginalFile(params.attachmentId, request);
      return withCors(response, request);
    }),

    PUT("/internal/parse/v1/files/:attachmentId/artifacts/batch", async (request, { params }) => {
      const response = await handleParseArtifactsBatch(params.attachmentId, request);
      return withCors(response, request);
    }),

    POST("/internal/parse/v1/files/:attachmentId/artifacts/batch", async (request, { params }) => {
      const response = await handleParseArtifactsBatch(params.attachmentId, request);
      return withCors(response, request);
    }),

    POST("/internal/parse/v1/files/:attachmentId/email-derived", async (request, { params }) => {
      const response = await handleParseEmailDerived(params.attachmentId, request);
      return withCors(response, request);
    }),

    PUT("/internal/parse/v1/files/:attachmentId/figures/:figureId", async (request, { params }) => {
      const response = await handleParseFigurePut(
        params.attachmentId,
        params.figureId,
        request,
      );
      return withCors(response, request);
    }),

    GET("/internal/parse/v1/files/:attachmentId/figures/:figureId", async (request, { params }) => {
      const response = await handleParseFigureGet(
        params.attachmentId,
        params.figureId,
        request,
      );
      return withCors(response, request);
    }),

    POST("/internal/parse/v1/webhook", async (request) => {
      const response = await handleParseWebhook(request);
      return withCors(response, request);
    }),
  ];
}
