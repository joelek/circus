// This file was auto-generated by @joelek/ts-autoguard. Edit at own risk.

import * as autoguard from "@joelek/ts-autoguard/dist/lib-server";
import * as shared from "./index";

export const makeServer = (routes: autoguard.api.Server<shared.Autoguard.Requests, shared.Autoguard.Responses>, serverOptions?: autoguard.api.MakeServerOptions): autoguard.api.RequestListener => {
	let endpoints = new Array<autoguard.api.Endpoint>();
	return (request, response) => autoguard.api.route(endpoints, request, response, serverOptions);
};
