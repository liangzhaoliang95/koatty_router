/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2022-10-29 11:15:30
 * @LastEditTime: 2022-10-29 11:26:39
 */
import { GrpcRouter } from "./router/grpc";
import { HttpRouter } from "./router/http";
import { WebsocketRouter } from "./router/websocket";
import { Koatty, KoattyRouter } from "koatty_core";
import { Helper } from "koatty_lib";

/**
 * RouterOptions
 *
 * @export
 * @interface RouterOptions
 */
export interface RouterOptions {
  prefix: string;
  /**
   * Methods which should be supported by the router.
   */
  methods?: string[];
  routerPath?: string;
  /**
   * Whether or not routing should be case-sensitive.
   */
  sensitive?: boolean;
  /**
   * Whether or not routes should matched strictly.
   *
   * If strict matching is enabled, the trailing slash is taken into
   * account when matching routes.
   */
  strict?: boolean;
  /**
   * gRPC protocol file
   */
  protoFile?: string;
  // 
  /**
   * Other extended configuration
   */
  ext?: any;
}

/**
 * get instance of Router
 *
 * @export
 * @param {Koatty} app
 * @param {RouterOptions} options
 * @param {string} [protocol]
 * @returns {*}  {KoattyRouter}
 */
export function NewRouter(app: Koatty, options: RouterOptions, protocol?: string): KoattyRouter {
  let router;
  switch (protocol) {
    case "grpc":
      router = new GrpcRouter(app, options);
      Helper.define(router, "protocol", protocol);
      break;
    case "ws":
    case "wss":
      router = new WebsocketRouter(app, options);
      Helper.define(router, "protocol", protocol);
      break;
    default:
      router = new HttpRouter(app, options);
      Helper.define(router, "protocol", protocol);
  }
  return router;
}