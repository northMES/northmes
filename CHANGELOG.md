# Changelog

## 0.0.1 (2026-10-15)


### ⚠ BREAKING CHANGES

* **core:** articles belong to the company and are assigned to one or more plants or to all plants ([#451](https://github.com/northMES/northmes/issues/451))
* **web:** move administration into the settings area with company and plant settings ([#435](https://github.com/northMES/northmes/issues/435))
* **core:** sign in with email only, and require an email for every new user ([#415](https://github.com/northMES/northmes/issues/415))
* **core:** check a command's permission at the scope of the row it changes ([#409](https://github.com/northMES/northmes/issues/409))
* **core:** companies, plants and the plant switcher ([#408](https://github.com/northMES/northmes/issues/408))
* **web:** build the D2 shell with sidebar, rail and top bar on shadcn's Base UI primitives ([#398](https://github.com/northMES/northmes/issues/398))
* **backend:** plain Nest modules in an api, core and infrastructure layout ([#397](https://github.com/northMES/northmes/issues/397))
* **sdk:** build errors on @nestjs/common exceptions ([#380](https://github.com/northMES/northmes/issues/380))
* **repo:** remove what the one-backend, one-web-app shape no longer uses ([#383](https://github.com/northMES/northmes/issues/383))
* **core:** list, create and edit articles over GraphQL with field errors and version checks ([#375](https://github.com/northMES/northmes/issues/375))
* **web:** build one static web app with every module's screens and drop Module Federation ([#371](https://github.com/northMES/northmes/issues/371))
* **backend:** move the server to apps/backend and serve one GraphQL schema with GraphQL Yoga ([#370](https://github.com/northMES/northmes/issues/370))
* **server:** read module data scoped to the plant, join two subgraphs and release an order through the command bus ([#340](https://github.com/northMES/northmes/issues/340))
* **server:** bootstrap database roles, migrate per module owner and build test apps ([#335](https://github.com/northMES/northmes/issues/335))

### Features

* **core:** a dashboard at the plant root with shared and own tabs of demo widgets ([#539](https://github.com/northMES/northmes/issues/539)) ([08fe9e2](https://github.com/northMES/northmes/commit/08fe9e25815af9f4e0fec0112c89f0d784d62f62))
* **core:** an article's name has translations, as localizedText ([#468](https://github.com/northMES/northmes/issues/468)) ([9f45f66](https://github.com/northMES/northmes/commit/9f45f66d721cf72b00137d23d6ad3da544c2f3e8))
* **core:** archive and restore articles ([#405](https://github.com/northMES/northmes/issues/405)) ([4f24d0e](https://github.com/northMES/northmes/commit/4f24d0e95dfaccc322b2735731bd6599168bdb4f))
* **core:** article groups, a company register under Master data, and each article's group ([#469](https://github.com/northMES/northmes/issues/469)) ([507a62e](https://github.com/northMES/northmes/commit/507a62edac997d32b0ef861faa1fe0cf7336d654))
* **core:** articles belong to the company and are assigned to one or more plants or to all plants ([#451](https://github.com/northMES/northmes/issues/451)) ([ec9e9e6](https://github.com/northMES/northmes/commit/ec9e9e6fd6df8a6aec98e8f2eae1313b3268511b))
* **core:** articles have a stock unit, a note and a source, with the article page and forms as DE1, DE5 and DE7 draw them ([#467](https://github.com/northMES/northmes/issues/467)) ([371172a](https://github.com/northMES/northmes/commit/371172aabd1b2484922585b1a74ca256314896e9))
* **core:** change an article's plants on Edit article, not on its page ([#533](https://github.com/northMES/northmes/issues/533)) ([ed86da3](https://github.com/northMES/northmes/commit/ed86da3c5fb92f641428259303d774fc473a7c9a))
* **core:** check a command's permission at the scope of the row it changes ([#409](https://github.com/northMES/northmes/issues/409)) ([8899de5](https://github.com/northMES/northmes/commit/8899de5f3421a88855bd7b6fff21c0040ecb7827))
* **core:** companies, plants and the plant switcher ([#408](https://github.com/northMES/northmes/issues/408)) ([81a134c](https://github.com/northMES/northmes/commit/81a134cb68f18e647a3309daf4af414ec5c29a35))
* **core:** create companies and their first admins, and reset passwords, from the command line ([#535](https://github.com/northMES/northmes/issues/535)) ([391eb13](https://github.com/northMES/northmes/commit/391eb13c9eff065bf74343914af2d3ccb9d8f46f))
* **core:** edit a dashboard tab's layout with the widget catalog and widget settings ([#545](https://github.com/northMES/northmes/issues/545)) ([bee2c5b](https://github.com/northMES/northmes/commit/bee2c5be2ed3d5f38c475603e2b66ad6bc7458bc))
* **core:** limit new companies and scope nodes to the write scopes with row-level security ([#543](https://github.com/northMES/northmes/issues/543)) ([15feb99](https://github.com/northMES/northmes/commit/15feb99e3b01701456b60b1184fe31c8c3cdf52f))
* **core:** list, create and edit articles over GraphQL with field errors and version checks ([#375](https://github.com/northMES/northmes/issues/375)) ([bb591af](https://github.com/northMES/northmes/commit/bb591af1e56bfbb5640bd8d3aeb3f766133f655c))
* **core:** list, show, create and edit articles in the web ([#382](https://github.com/northMES/northmes/issues/382)) ([dada7e1](https://github.com/northMES/northmes/commit/dada7e1e54e8a17e71fbbdba6fc7d15554940e90))
* **core:** manage users, roles and access ([#411](https://github.com/northMES/northmes/issues/411)) ([bec9f86](https://github.com/northMES/northmes/commit/bec9f868cc28a5e043c16145dd5ac0908852e3a9))
* **core:** rate-limit GraphQL requests per principal ([#521](https://github.com/northMES/northmes/issues/521)) ([8cc419c](https://github.com/northMES/northmes/commit/8cc419c6d09fe20009d447a7f7c7fa01402bc51a))
* **core:** refuse GraphQL requests that are too large, too deep or too costly ([#504](https://github.com/northMES/northmes/issues/504)) ([11e1b01](https://github.com/northMES/northmes/commit/11e1b01725897fcca0f23ebe2f537294d839accc))
* **core:** sign in with Better Auth, bearer tokens for the web and a sign-in page ([#406](https://github.com/northMES/northmes/issues/406)) ([fa1579e](https://github.com/northMES/northmes/commit/fa1579e69d56cf5987f90c1fb4a3753f3a5ae7ea))
* **core:** sign in with email only, and require an email for every new user ([#415](https://github.com/northMES/northmes/issues/415)) ([42fe1ec](https://github.com/northMES/northmes/commit/42fe1ecba78f912acdbe42950f61e181fe7d2e13))
* **core:** the articles list filters by article group, stock unit and source with counts, groups by them, and hides columns ([#470](https://github.com/northMES/northmes/issues/470)) ([febc7a9](https://github.com/northMES/northmes/commit/febc7a9d096e7afe8154d06276b1de5f8b5c736a))
* **core:** user and role settings with temporary passwords, core's pages at the plant root, and the UI findings ([#453](https://github.com/northMES/northmes/issues/453)) ([caac60a](https://github.com/northMES/northmes/commit/caac60a1cebb631cb487e1a090c4daf0a68f914f))
* **ops:** ship v0.0.1 as one image, a Compose bundle and release-please ([#548](https://github.com/northMES/northmes/issues/548)) ([14b1857](https://github.com/northMES/northmes/commit/14b1857c5eefa1b196b91306321d2f650f85d971))
* **platform:** build drop-in plugins with pnpm plugin:build and load those listed in northmes.config.json ([#359](https://github.com/northMES/northmes/issues/359)) ([4cb2429](https://github.com/northMES/northmes/commit/4cb24297afd6010cac823dffff4bb48f3a390b70))
* **repo:** start the app with pnpm dev ([#346](https://github.com/northMES/northmes/issues/346)) ([467a66d](https://github.com/northMES/northmes/commit/467a66de6d830c96ea7e308440f8a1d4a93bdd42))
* **repo:** stop a run when the Node major differs from .node-version ([#217](https://github.com/northMES/northmes/issues/217)) ([2858488](https://github.com/northMES/northmes/commit/28584886e6833fcbffe1964fa10dc84b40a8d1ba))
* **sdk:** one operation contract per capability, bound to the module service, with the article operations and upsert by article number ([#452](https://github.com/northMES/northmes/issues/452)) ([efcb6fe](https://github.com/northMES/northmes/commit/efcb6febb59ceaacdfd967df5892c89f651922b3))
* **testing:** run .test.tsx files in a web Vitest project with React and happy-dom ([#316](https://github.com/northMES/northmes/issues/316)) ([3fd6fdf](https://github.com/northMES/northmes/commit/3fd6fdf63ec08f694422c06e035f5ed78a9e0cbf))
* **web:** add the design tokens, one stylesheet and the list and form components ([#376](https://github.com/northMES/northmes/issues/376)) ([d9a87cc](https://github.com/northMES/northmes/commit/d9a87cc19b441579da8fc3a3dcd97be415cc3e0d))
* **web:** build the D2 shell with sidebar, rail and top bar on shadcn's Base UI primitives ([#398](https://github.com/northMES/northmes/issues/398)) ([5a5d834](https://github.com/northMES/northmes/commit/5a5d834b22ddac677d3c01cd2ebc8eb9885c7c76))
* **web:** move administration into the settings area with company and plant settings ([#435](https://github.com/northMES/northmes/issues/435)) ([53217f2](https://github.com/northMES/northmes/commit/53217f2ef9a0873f6070bd15ed1b6630514eda88))
* **web:** type the web's Apollo documents with GraphQL Code Generator ([#402](https://github.com/northMES/northmes/issues/402)) ([914a52f](https://github.com/northMES/northmes/commit/914a52fce5567ad1784fbbf8f9c9d9f93d094fc7))


### Bug Fixes

* **backend:** a page opened on the API's address in pnpm dev redirects to the web app ([#466](https://github.com/northMES/northmes/issues/466)) ([8ab409b](https://github.com/northMES/northmes/commit/8ab409bde41f27f98e4254a7b4fc41df5d959ad0))
* **core:** access pages and the articles list as core-304 and ui-222 draw them ([#433](https://github.com/northMES/northmes/issues/433)) ([03e4ee9](https://github.com/northMES/northmes/commit/03e4ee9bc2d6daef9e95eef33f6abd27ac1ed98e))
* **deps:** raise @graphql-tools/utils and sharp to their fixed versions ([#525](https://github.com/northMES/northmes/issues/525)) ([b46f863](https://github.com/northMES/northmes/commit/b46f86367aff56ef492ded26d3bffc29ca21a3fd))
* **e2e:** show tall pages whole in the Argos screenshots ([#523](https://github.com/northMES/northmes/issues/523)) ([4368cd4](https://github.com/northMES/northmes/commit/4368cd42dfe66c1ba7fea8fa3ea889e0581a6cc2))
* **repo:** add a new secret's _FILE key to an existing dev.env, so pnpm dev starts after an update ([#413](https://github.com/northMES/northmes/issues/413)) ([a0a485c](https://github.com/northMES/northmes/commit/a0a485cdf41b0357ad95a2529aeb6c4fbd941270))
* **web:** error pages, the unknown-plant page, focus not obscured and the Help menu as D2 and shell-306 draw them ([#436](https://github.com/northMES/northmes/issues/436)) ([86c9903](https://github.com/northMES/northmes/commit/86c9903e8b2c0750ded14871ca4910803f42134e))
* **web:** reset the announcement queue after each web test ([#531](https://github.com/northMES/northmes/issues/531)) ([44f67b7](https://github.com/northMES/northmes/commit/44f67b7467cd4cafb63f54f0ebb662d4b1af8000))
* **web:** stop the announcement queue quietly when its page is gone ([#494](https://github.com/northMES/northmes/issues/494)) ([f3fe464](https://github.com/northMES/northmes/commit/f3fe46477fb39787fb886218818f507b9d6fe218))
* **web:** the sidebar draws no rules between module groups, under the plant switcher, above the user button or along a nested group ([#461](https://github.com/northMES/northmes/issues/461)) ([d5d3bc6](https://github.com/northMES/northmes/commit/d5d3bc671d352a7801accb1ebde14b74f5b3c085))


### Miscellaneous Chores

* **repo:** remove what the one-backend, one-web-app shape no longer uses ([#383](https://github.com/northMES/northmes/issues/383)) ([bdbb357](https://github.com/northMES/northmes/commit/bdbb357a70b0e927b68b4af5a20c9551d4a19cf2))
* **server:** bootstrap database roles, migrate per module owner and build test apps ([#335](https://github.com/northMES/northmes/issues/335)) ([9804272](https://github.com/northMES/northmes/commit/98042728f5d929e6ca56c182001daed90bb7a20f))
* **server:** read module data scoped to the plant, join two subgraphs and release an order through the command bus ([#340](https://github.com/northMES/northmes/issues/340)) ([8fcbc15](https://github.com/northMES/northmes/commit/8fcbc157e5fbc4461bd03422fda6e52203e03f5d))


### Code Refactoring

* **backend:** move the server to apps/backend and serve one GraphQL schema with GraphQL Yoga ([#370](https://github.com/northMES/northmes/issues/370)) ([4a00f2e](https://github.com/northMES/northmes/commit/4a00f2ef5bc5bdf879868d5530f821906801b1f0))
* **backend:** plain Nest modules in an api, core and infrastructure layout ([#397](https://github.com/northMES/northmes/issues/397)) ([810d1af](https://github.com/northMES/northmes/commit/810d1afc4af26a3c4381ed19a98cc6ffa1c40e2b))
* **sdk:** build errors on @nestjs/common exceptions ([#380](https://github.com/northMES/northmes/issues/380)) ([81f76cf](https://github.com/northMES/northmes/commit/81f76cf1c337bb2f55f726fa084b710bffc68006))
* **web:** build one static web app with every module's screens and drop Module Federation ([#371](https://github.com/northMES/northmes/issues/371)) ([bac8453](https://github.com/northMES/northmes/commit/bac845392a053d2b8acf612169dc9540c73fcb38))
