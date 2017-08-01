import * as fs from 'fs';
import {resolve} from "path";
import {createBundleRenderer, BundleRenderer} from 'vue-server-renderer';
import * as LRU from 'lru-cache';
import * as express from "express";
import {Renderer} from "../core/Renderer";

const production = process.env.NODE_ENV === 'production';

const serve = (path, cache) => express.static(resolve(__dirname, path), {
    maxAge: cache ? 1000 * 60 * 60 * 24 * 30 : 0
});

export class ServerRenderer implements Renderer {

    private renderer: BundleRenderer;
    private promise: Promise<any>;

    private static createRenderer(bundle, options): BundleRenderer {
        return createBundleRenderer(bundle, Object.assign(options, {
            template: fs.readFileSync(resolve('./src/index.html'), 'utf-8'),
            cache: LRU({
                max: 1000,
                maxAge: 1000 * 60 * 15
            }),
            basedir: './dist',
            runInNewContext: false
        }));
    }

    private _render(req: express.Request, res: express.Response) {
        const context = {
            url: req.url
        };

        const handleError = error => {
            if (error.url) {
                res.redirect(error.url)
            } else if (error.code === 404) {
                res.status(404).end('404 | Page Not Found')
            } else {
                res.status(500).end('500 | Internal Server Error');
                console.error(error.stack)
            }
        };

        this.renderer.renderToString(context, (error, html) => {
            if (error) {
                return handleError(error)
            }

            res.end(html);
        });
    }

    public initialize(express: express.Express) {
        express.use('/public', serve(resolve('./public'), true));

        if (production) {
            express.use('/', serve(resolve('./dist'), true));
            express.use('/dist', serve(resolve('./dist'), true));

            const bundle = require(resolve('./dist/vue-ssr-server-bundle.json'));
            const manifest = require(resolve('./dist/vue-ssr-client-manifest.json'));

            this.renderer = ServerRenderer.createRenderer(bundle, {
                manifest
            });
        } else {
            this.promise = require(resolve('./setup-dev-server'))(express, (bundle, options) => {
                this.renderer = ServerRenderer.createRenderer(bundle, options)
            });
        }
    }

    public render(req: express.Request, res: express.Response): void {
        if (production) {
            this._render(req, res);
        } else {
            this.promise.then(() => {
                this._render(req, res);
            });
        }
    }
}