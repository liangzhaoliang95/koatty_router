/*
 * @Description:
 * @Usage:
 * @Author: richen
 * @Date: 2021-06-28 19:02:06
 * @LastEditTime: 2021-06-28 19:10:44
 */
import KoaRouter from "@koa/router";
import { Helper, Koatty, KoattyContext, Logger } from "koatty";
import { IOCContainer, RecursiveGetMetadata } from "koatty_container";
import { checkParams, PARAM_CHECK_KEY, PARAM_RULE_KEY } from "koatty_validation";
import { CONTROLLER_ROUTER, PARAM_KEY, Router, ROUTER_KEY } from "./index";

/**
 * HttpRouter class
 */
export class HttpRouter implements Router {
    app: Koatty;
    options: any;
    router: KoaRouter<any, unknown>;

    constructor(app: Koatty, options?: any) {
        this.app = app;
        // prefix: string;
        // /**
        //  * Methods which should be supported by the router.
        //  */
        // methods ?: string[];
        // routerPath ?: string;
        // /**
        //  * Whether or not routing should be case-sensitive.
        //  */
        // sensitive ?: boolean;
        // /**
        //  * Whether or not routes should matched strictly.
        //  *
        //  * If strict matching is enabled, the trailing slash is taken into
        //  * account when matching routes.
        //  */
        // strict ?: boolean;
        this.options = {
            ...options
        };
        // initialize
        this.router = new KoaRouter(this.options);
    }

    /**
     * Loading router
     *
     * @memberof Router
     */
    LoadRouter() {
        try {
            const app = this.app;
            const kRouter: any = this.router;

            const controllers = app.getMap("controllers") ?? {};
            // tslint:disable-next-line: forin
            for (const n in controllers) {
                const ctl = IOCContainer.getClass(n, "CONTROLLER");
                // inject router
                const ctlRouters = injectRouter(app, ctl);
                // inject param
                const ctlParams = injectParam(app, ctl);
                // tslint:disable-next-line: forin
                for (const it in ctlRouters) {
                    Logger.Debug(`Register request mapping: [${ctlRouters[it].requestMethod}] : ["${ctlRouters[it].path}" => ${n}.${ctlRouters[it].method}]`);
                    kRouter[ctlRouters[it].requestMethod](ctlRouters[it].path, function (ctx: KoattyContext): Promise<any> {
                        const router = ctlRouters[it];
                        return execRouter(app, ctx, n, router, ctlParams[router.method]);
                    });
                }
            }

            // Load in the 'appStart' event to facilitate the expansion of middleware
            // exp: in middleware
            // app.Router.get('/xxx',  (ctx: Koa.Context): any => {...})
            app.on('appStart', () => {
                app.use(kRouter.routes()).use(kRouter.allowedMethods());
            });
        } catch (err) {
            Logger.Error(err);
        }
    }

}

/**
 * Execute controller
 *
 * @param {Koatty} app
 * @param {KoattyContext} ctx
 * @param {string} identifier
 * @param {*} router
 * @param {*} ctlParams
 * @returns
 * @memberof Router
 */
async function execRouter(app: Koatty, ctx: KoattyContext, identifier: string, router: any, ctlParams: any) {
    const ctl: any = IOCContainer.get(identifier, "CONTROLLER", [ctx]);

    // const ctl: any = container.get(identifier, "CONTROLLER");
    if (!ctx || !ctl.init) {
        return ctx.throw(404, `Controller ${identifier} not found.`);
    }
    // inject param
    let args = [];
    if (ctlParams) {
        args = await getParamter(app, ctx, ctlParams);
    }
    // method
    return ctl[router.method](...args);
}

/**
 *
 *
 * @param {Koatty} app
 * @param {*} target
 * @param {*} [instance]
 * @returns {*} 
 */
function injectRouter(app: Koatty, target: any, instance?: any) {
    // Controller router path
    const metaDatas = IOCContainer.listPropertyData(CONTROLLER_ROUTER, target);
    let path = "";
    const identifier = IOCContainer.getIdentifier(target);
    if (metaDatas) {
        path = metaDatas[identifier] ?? "";
    }
    path = path.startsWith("/") || path === "" ? path : `/${path}`;

    const rmetaData = RecursiveGetMetadata(ROUTER_KEY, target);
    const router: any = {};
    // tslint:disable-next-line: forin
    for (const metaKey in rmetaData) {
        Logger.Debug(`Register inject method Router key: ${metaKey} => value: ${JSON.stringify(rmetaData[metaKey])}`);
        //.sort((a, b) => b.priority - a.priority) 
        for (const val of rmetaData[metaKey]) {
            const tmp = {
                ...val,
                path: `${path}${val.path}`.replace("//", "/")
            };
            router[`${tmp.path}-${tmp.requestMethod}`] = tmp;
        }
    }

    return router;
}

/**
 *
 *
 * @param {Koatty} app
 * @param {*} target
 * @param {*} [instance]
 * @returns {*} 
 */
function injectParam(app: Koatty, target: any, instance?: any) {
    instance = instance ?? target.prototype;
    const metaDatas = RecursiveGetMetadata(PARAM_KEY, target);
    const validMetaDatas = RecursiveGetMetadata(PARAM_RULE_KEY, target);
    const validatedMetaDatas = RecursiveGetMetadata(PARAM_CHECK_KEY, target);
    const argsMetaObj: any = {};
    for (const meta in metaDatas) {
        if (instance[meta] && instance[meta].length <= metaDatas[meta].length) {
            Logger.Debug(`Register inject ${IOCContainer.getIdentifier(target)} param key: ${Helper.toString(meta)} => value: ${JSON.stringify(metaDatas[meta])}`);

            // cover to obj
            const data = (metaDatas[meta] ?? []).sort((a: any, b: any) => a.index - b.index);
            const validData = validMetaDatas[meta] ?? [];
            const validMetaObj: any = {};
            data.forEach((v: any) => {
                validData.forEach((it: any) => {
                    if (v.index === it.index) {
                        validMetaObj[v.index] = it;
                    }
                });
            });
            argsMetaObj[meta] = {
                valids: validMetaObj,
                data,
                dtoCheck: (validatedMetaDatas[meta] && validatedMetaDatas[meta].dtoCheck) ? true : false
            };
        }
    }
    return argsMetaObj;
}


/**
 * Convert paramter types and valid check.
 *
 * @param {Koatty} app
 * @param {KoattyContext} ctx
 * @param {any[]} params
 * @returns
 */
async function getParamter(app: Koatty, ctx: KoattyContext, ctlParams: any = {}) {
    //convert type
    const params = ctlParams.data ?? [];
    const validRules = ctlParams.valids ?? {};
    const dtoCheck = ctlParams.dtoCheck ?? false;
    const props: any[] = params.map(async (v: any, k: number) => {
        let value: any = null;
        if (v.fn && Helper.isFunction(v.fn)) {
            value = await v.fn(ctx);
        }
        // check params
        return checkParams(value, {
            index: k,
            isDto: v.isDto,
            type: v.type,
            validRules,
            dtoCheck,
        });
    });
    return Promise.all(props);
}