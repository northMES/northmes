# Changelog

## [0.2.0](https://github.com/northMES/northmes/compare/v0.1.0...v0.2.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* **web:** every settings page opens under /<plant>/settings, the company's pages included ([#905](https://github.com/northMES/northmes/issues/905))

### Features

* **ci:** sort pull requests into risk tiers with a blast-radius review and a risk gate ([#761](https://github.com/northMES/northmes/issues/761)) ([01fa5b8](https://github.com/northMES/northmes/commit/01fa5b8d50cb04c5a42eb4a6806e6e3d5c7c05db))
* **core:** accept integration tokens on the public REST API, with optional rate limits per credential ([#684](https://github.com/northMES/northmes/issues/684)) ([28b6cf0](https://github.com/northMES/northmes/commit/28b6cf06854ba8d6eab2a589826e57b91ed458b7))
* **core:** codes unique per scope through an exclusion constraint ([#959](https://github.com/northMES/northmes/issues/959)) ([cd48a5b](https://github.com/northMES/northmes/commit/cd48a5b96bd875f17b7e931618c41df5757ea53e))
* **core:** create, list and revoke integration tokens ([#673](https://github.com/northMES/northmes/issues/673)) ([b02464b](https://github.com/northMES/northmes/commit/b02464bff7552d74f14c4baa49d5272b0028fb34))
* **core:** each shift in its own colour on the calendar's week view ([#781](https://github.com/northMES/northmes/issues/781)) ([5dfa8fd](https://github.com/northMES/northmes/commit/5dfa8fdf89b22970d84f7f9060dd0bd9eb7dfdbc))
* **core:** equipment groups in plant settings, with a group's page and its color form, on the fixture G1 ([#786](https://github.com/northMES/northmes/issues/786)) ([5e5e12a](https://github.com/northMES/northmes/commit/5e5e12a305202386e83edfba3f6559b844a3ec3d))
* **core:** machines at plant scope, built with the master-data kit ([#969](https://github.com/northMES/northmes/issues/969)) ([8e4e97c](https://github.com/northMES/northmes/commit/8e4e97c11954d89303dfd43ed5a8406cf8accd3d))
* **core:** publish the public API's OpenAPI document, with a breaking-change gate in CI ([#717](https://github.com/northMES/northmes/issues/717)) ([6b59d67](https://github.com/northMES/northmes/commit/6b59d674fbc148781b4b32426aea99c03c2f1beb))
* **core:** serve article operations as public REST routes under /api/v1/core ([#671](https://github.com/northMES/northmes/issues/671)) ([6b4bf7e](https://github.com/northMES/northmes/commit/6b4bf7e4f916ca47f5f98caccdc1181f5f6b4810))
* **core:** the customers register, a customer's page and a customer order's page on the fixture G1 ([#769](https://github.com/northMES/northmes/issues/769)) ([b5d0fbe](https://github.com/northMES/northmes/commit/b5d0fbe7bc764ccad0b99667c4ae27faf7539b42))
* **core:** the machines, machine and calendar pages in plant settings on the fixture G1 ([#760](https://github.com/northMES/northmes/issues/760)) ([ff6c7f0](https://github.com/northMES/northmes/commit/ff6c7f0dea98e0d9e1be531efb63ae0930eea4b4))
* **core:** the master-data kit with equipment groups as its first register ([#963](https://github.com/northMES/northmes/issues/963)) ([996fb7f](https://github.com/northMES/northmes/commit/996fb7f906efbb452e339963e72b400c84687220))
* **core:** the plant's own page in plant settings, with the production day start checked against the zone ([#790](https://github.com/northMES/northmes/issues/790)) ([b0517c4](https://github.com/northMES/northmes/commit/b0517c458a5463746309714f98bd511b75e12373))
* **core:** the routings register, an article's routing with its planned duration, and the operation edit form on the fixture G1 ([#778](https://github.com/northMES/northmes/issues/778)) ([af52832](https://github.com/northMES/northmes/commit/af5283216f0419ca9e1d08fa83bf073a37031557))
* **core:** the tools register and a tool's page on the fixture G1 ([#779](https://github.com/northMES/northmes/issues/779)) ([0d8d9cb](https://github.com/northMES/northmes/commit/0d8d9cbc33e31ed24049e9d42dc17d8903b3091c))
* **planning:** a slim bar above the Gantt and the board, with the zoom buttons over the time area ([#952](https://github.com/northMES/northmes/issues/952)) ([8358cc7](https://github.com/northMES/northmes/commit/8358cc723649d84edbb493162b5e13a92be3914b))
* **planning:** a smooth zoom on the Gantt and the board ([#949](https://github.com/northMES/northmes/issues/949)) ([fc321de](https://github.com/northMES/northmes/commit/fc321deab66d402ac3041fbce98299d57b19997d))
* **planning:** an endless time axis on the board and the Gantt ([#936](https://github.com/northMES/northmes/issues/936)) ([3460898](https://github.com/northMES/northmes/commit/34608984bb62487c27ef0b9eb6a0c886ae9f58d6))
* **planning:** an order filter above the Gantt and the board ([#953](https://github.com/northMES/northmes/issues/953)) ([c61f9d8](https://github.com/northMES/northmes/commit/c61f9d8803bcf477e38ec546eb2159fcb72b79f9))
* **planning:** block states, selection, the hover card and clusters on the planning board ([#774](https://github.com/northMES/northmes/issues/774)) ([2046457](https://github.com/northMES/northmes/commit/20464575b5ff07488f62aa08096dcc108a5cadad))
* **planning:** cascade a move through the later operations of an order ([#696](https://github.com/northMES/northmes/issues/696)) ([13de319](https://github.com/northMES/northmes/commit/13de3191a48cd8d62f2f61ae0ed34d83de081a14))
* **planning:** choose the fields a block and its hover card show, on the fixture G1 ([#777](https://github.com/northMES/northmes/issues/777)) ([0ecce37](https://github.com/northMES/northmes/commit/0ecce37049b63b11d66e1c5ac4a132da38f8ffc1))
* **planning:** combine orders of one article into a run on the order Gantt ([#715](https://github.com/northMES/northmes/issues/715)) ([9ee982d](https://github.com/northMES/northmes/commit/9ee982d192925625c7ec3df1a84bc9f2ef0d090f))
* **planning:** combineIntoRun and splitRun, the run of orders of one article as pure functions ([#713](https://github.com/northMES/northmes/issues/713)) ([8ac40e9](https://github.com/northMES/northmes/commit/8ac40e97b5d2f04064fb47973ec7e953918dd3d1))
* **planning:** Details of a board job order in the Gantt's drawer ([#802](https://github.com/northMES/northmes/issues/802)) ([52eb9a2](https://github.com/northMES/northmes/commit/52eb9a28cd59b6ea24a8a096e40f8262a132a0cc))
* **planning:** each Gantt block describes itself with its hover card content ([#922](https://github.com/northMES/northmes/issues/922)) ([cb1e4f3](https://github.com/northMES/northmes/commit/cb1e4f34363d1a140e7c533d3a4efa6e65f587a8))
* **planning:** float, wait, the binding constraint and the critical chain as domain functions ([#694](https://github.com/northMES/northmes/issues/694)) ([93046ca](https://github.com/northMES/northmes/commit/93046cafe4108a43e65ea059cc98ace97d9f1f10))
* **planning:** machines a job order cannot run on are greyed out while it moves ([#946](https://github.com/northMES/northmes/issues/946)) ([2560f96](https://github.com/northMES/northmes/commit/2560f968e93f6258967d3905620ccd749e55ad37))
* **planning:** move a job order on the Gantt, with the cascade preview and the My draft drawer ([#701](https://github.com/northMES/northmes/issues/701)) ([d34d123](https://github.com/northMES/northmes/commit/d34d123495f205198a02e567f89d000f58befe80))
* **planning:** New production order and New customer order, with entered orders on the lists and the Gantt ([#803](https://github.com/northMES/northmes/issues/803)) ([618670b](https://github.com/northMES/northmes/commit/618670b241872f18c745ea8edc2ff2e4fbd3e02e))
* **planning:** one draft for the board, the Gantt and the job order table, and keyboard move mode on the board ([#782](https://github.com/northMES/northmes/issues/782)) ([3ba9880](https://github.com/northMES/northmes/commit/3ba988083f4291b9421054f7013e8f8afaebd859))
* **planning:** order 1005 in the fixture G1 and the run case GT10 ([#711](https://github.com/northMES/northmes/issues/711)) ([eed8873](https://github.com/northMES/northmes/commit/eed8873e0c6617e14c5c084f19172f0eed4d9dae))
* **planning:** order Gantt on mock data, blocks, links and markers ([#662](https://github.com/northMES/northmes/issues/662)) ([845b5cb](https://github.com/northMES/northmes/commit/845b5cb738f48bcd640ec1015fafbe51f385b1f4))
* **planning:** order Gantt on mock data, Details, chain and workload ([#667](https://github.com/northMES/northmes/issues/667)) ([93fc400](https://github.com/northMES/northmes/commit/93fc40011df7b2fb807f08a2997c37d183c6c500))
* **planning:** order Gantt on mock data, keyboard and the axe spec ([#664](https://github.com/northMES/northmes/issues/664)) ([8c1c202](https://github.com/northMES/northmes/commit/8c1c2020dfe02934a88b87bfd41c357a1a508859))
* **planning:** order Gantt on mock data, search and tree ([#661](https://github.com/northMES/northmes/issues/661)) ([640ef9c](https://github.com/northMES/northmes/commit/640ef9ca395f4a97838e4f92c8919c03fc205c9f))
* **planning:** pointer moves, the block menu and the Move dialog on the planning board ([#800](https://github.com/northMES/northmes/issues/800)) ([1640804](https://github.com/northMES/northmes/commit/16408042dc7a1200630d58f5e5105701a1144189))
* **planning:** resize the Gantt's tree columns and the board's machine column by their header edge ([#948](https://github.com/northMES/northmes/issues/948)) ([1520a93](https://github.com/northMES/northmes/commit/1520a93cedb1e0364b90701ea802625a32254aa8))
* **planning:** the board and the Gantt load their rows by page and their job orders by time chunk ([#937](https://github.com/northMES/northmes/issues/937)) ([c770f36](https://github.com/northMES/northmes/commit/c770f36f51915ac0d4b4f522390f31c3c1089eb4))
* **planning:** the calendar kernel of the planning domain, windows and work over availability ([#692](https://github.com/northMES/northmes/issues/692)) ([3efbcdf](https://github.com/northMES/northmes/commit/3efbcdf618d20ebccd1a8da7d158030952f7f1d2))
* **planning:** the Details drawer leads with the move decision and folds the rest ([#921](https://github.com/northMES/northmes/issues/921)) ([b416c47](https://github.com/northMES/northmes/commit/b416c476549c7e606e0fa6b8ea93613fcff8d27e))
* **planning:** the Gantt data source answers rows and time chunks ([#934](https://github.com/northMES/northmes/issues/934)) ([4ea0637](https://github.com/northMES/northmes/commit/4ea0637efeefca3b66d80320c26792c8b760a15d))
* **planning:** the Gantt's analysis from the domain functions, with g1.expected.json as the oracle ([#700](https://github.com/northMES/northmes/issues/700)) ([bad32c3](https://github.com/northMES/northmes/commit/bad32c3c4f9c4093fc25ab21df9c1fa5d8a047a1))
* **planning:** the Gantt's time area scrolls while a block is dragged to its edge ([#920](https://github.com/northMES/northmes/issues/920)) ([83e5718](https://github.com/northMES/northmes/commit/83e5718fb103b6058367ae7c2b0479e3f63e4dba))
* **planning:** the Gantt's workload follows the drag preview and marks overload by shape ([#923](https://github.com/northMES/northmes/issues/923)) ([cc75c8d](https://github.com/northMES/northmes/commit/cc75c8d9b578abdf7c24427305f6a58082d2ed8c))
* **planning:** the job orders page lists open job orders, without weeks ([#964](https://github.com/northMES/northmes/issues/964)) ([0f77660](https://github.com/northMES/northmes/commit/0f77660ba9b1ee3b7e9802116a6ad4e87e209983))
* **planning:** the job orders page under Planning, on the fixture G1 ([#721](https://github.com/northMES/northmes/issues/721)) ([01fbbc7](https://github.com/northMES/northmes/commit/01fbbc77c5f09144e70009b58e4a37463e231dfa))
* **planning:** the material warning on the order Gantt on the fixture G1 ([#776](https://github.com/northMES/northmes/issues/776)) ([a25c9e1](https://github.com/northMES/northmes/commit/a25c9e157e520b3cb6ca7e9d3120309ce65bb821))
* **planning:** the order Gantt as its own page, with time scrolling, page height and a Details drawer ([#680](https://github.com/northMES/northmes/issues/680)) ([fb9bd9a](https://github.com/northMES/northmes/commit/fb9bd9acf5e991ad766863636594000770f8f379))
* **planning:** the planning board's loading, no machines, failed and no access states ([#775](https://github.com/northMES/northmes/issues/775)) ([e023605](https://github.com/northMES/northmes/commit/e023605b7ffed4ef9dea43700c52f2e810fd1084))
* **planning:** the planning board's machine rows, time axis and blocks on the fixture G1 ([#773](https://github.com/northMES/northmes/issues/773)) ([10c1ee2](https://github.com/northMES/northmes/commit/10c1ee271d8c1665f868587ad216b41846125dd4))
* **planning:** the planning rules page in plant settings, with saved rules on the Gantt ([#801](https://github.com/northMES/northmes/issues/801)) ([32c311a](https://github.com/northMES/northmes/commit/32c311a3054765f932f09c238e8448286986668e))
* **planning:** the production order page and its edit form on the fixture G1 ([#723](https://github.com/northMES/northmes/issues/723)) ([a9ab02b](https://github.com/northMES/northmes/commit/a9ab02b5a2075aba58303c2d10a945ccce52f1f2))
* **planning:** the production orders and customer orders lists on the fixture G1 ([#725](https://github.com/northMES/northmes/issues/725)) ([f8ae38e](https://github.com/northMES/northmes/commit/f8ae38e848da396e13a5b46eee67367730845630))
* **planning:** the timeline zooms through a ladder of seven levels ([#930](https://github.com/northMES/northmes/issues/930)) ([9acc9f3](https://github.com/northMES/northmes/commit/9acc9f39c914241fd5fb29552480649550e25651))
* **planning:** the warehouses register, the Stock page and the stock of one article on the fixture G1 ([#772](https://github.com/northMES/northmes/issues/772)) ([30971e5](https://github.com/northMES/northmes/commit/30971e5b1b5ad686773fad69c5d097371210382b))
* **planning:** time before now is greyed and refuses moves ([#935](https://github.com/northMES/northmes/issues/935)) ([d5b2708](https://github.com/northMES/northmes/commit/d5b270893ebd206840210372c36290e86d534c9d))
* **planning:** workload per bucket and the constraint list of a row as domain functions ([#698](https://github.com/northMES/northmes/issues/698)) ([e9ea615](https://github.com/northMES/northmes/commit/e9ea6157ea401a14af51e24610889090ccba87c1))
* **planning:** zoom the board and the Gantt with Ctrl+wheel, a pinch, the keys and Zoom to fit ([#932](https://github.com/northMES/northmes/issues/932)) ([cbbfa92](https://github.com/northMES/northmes/commit/cbbfa927a46fe4299f807583bdaf7971b0414f74))
* **web:** show the NorthMES logo in the header and as the favicon ([#814](https://github.com/northMES/northmes/issues/814)) ([584d5de](https://github.com/northMES/northmes/commit/584d5de12111cdaadb7f6ebccc6b9c9ba847a182))


### Bug Fixes

* **agents:** one step after a pull request opens, a harm-based risk tier, and an approval that turns the gate green ([#819](https://github.com/northMES/northmes/issues/819)) ([f358aa8](https://github.com/northMES/northmes/commit/f358aa8e809f861818e46ee3601265a1a899a29a))
* **ci:** run the deprecated API scan outside the coverage counters ([#807](https://github.com/northMES/northmes/issues/807)) ([9644fdb](https://github.com/northMES/northmes/commit/9644fdb36075649ff40ed3af448dfbac101127be))
* **core:** require a browser origin for password sign-in ([#645](https://github.com/northMES/northmes/issues/645)) ([600f21a](https://github.com/northMES/northmes/commit/600f21a28d4455833e84894ef9a02f19b6838fd7))
* **deps:** raise @graphql-tools/utils to 12.0.2 for GHSA-c4qx-w738-7hr3 ([#817](https://github.com/northMES/northmes/issues/817)) ([9870a56](https://github.com/northMES/northmes/commit/9870a566bfcb02d0bd28e145df107e8074775824))
* **deps:** raise the MCP SDK to 2.3.1 and vite to 8.3.3 past three high advisories ([#755](https://github.com/northMES/northmes/issues/755)) ([6a16640](https://github.com/northMES/northmes/commit/6a166401ad1cd218033f04e6c88273a3d9ae9c16))
* **deps:** zod, body-parser, multer, undici and happy-dom for five advisories ([#832](https://github.com/northMES/northmes/issues/832)) ([e1a7a6d](https://github.com/northMES/northmes/commit/e1a7a6d9d73ecaa8a7c899773b1033973ae42373))
* **dev:** start the server after a pretty-printed tsc build ([#677](https://github.com/northMES/northmes/issues/677)) ([8d19bf8](https://github.com/northMES/northmes/commit/8d19bf8d0def97f5c70cfb06979b0f5b4680d854))
* **graphql:** masked errors carry a correlation id that the server log names ([#850](https://github.com/northMES/northmes/issues/850)) ([cb60ef1](https://github.com/northMES/northmes/commit/cb60ef1f2275de390186f7765e0f8136f3a44fbd))
* **planning:** a click on the board selects, a double click opens Details ([#915](https://github.com/northMES/northmes/issues/915)) ([d902cf9](https://github.com/northMES/northmes/commit/d902cf96b5355877e6cf2824fcc3b06cabbca0f9))
* **planning:** a click on the Gantt selects, a double click opens Details ([#889](https://github.com/northMES/northmes/issues/889)) ([63d9547](https://github.com/northMES/northmes/commit/63d9547bd79e316bd96aae5cf37e6426b0dd0c0d))
* **planning:** a Gantt block's text reads over a hollow segment in the dark theme, and the deadline label over the late band ([#887](https://github.com/northMES/northmes/issues/887)) ([be7140c](https://github.com/northMES/northmes/commit/be7140c28ae4d3a7b5decfb9b45daf6efa297eb4))
* **planning:** keep the browser's swipe navigation out of the Gantt and extend the time range at its edges ([#702](https://github.com/northMES/northmes/issues/702)) ([fba0b06](https://github.com/northMES/northmes/commit/fba0b066ee925b467c0c78564f233c01735d76be))
* **planning:** the Gantt page is called Order Gantt, at /planning/order-gantt ([#966](https://github.com/northMES/northmes/issues/966)) ([455655f](https://github.com/northMES/northmes/commit/455655f6c71aa32676ea0e2453bbd5cc7cc75b21))
* **planning:** the Gantt's header labels stay readable and out of collapsed closed time ([#913](https://github.com/northMES/northmes/issues/913)) ([8dc573f](https://github.com/northMES/northmes/commit/8dc573f3015152c3a3d8230aa872a4f22bf7a05c))
* **planning:** the Gantt's Not placed label stays above the rows that scroll under it ([#925](https://github.com/northMES/northmes/issues/925)) ([8153ff9](https://github.com/northMES/northmes/commit/8153ff9fff4f1352d2e6ccd4d75cafe66719bb3d))
* **planning:** the Gantt's now label shows the plant time alone ([#888](https://github.com/northMES/northmes/issues/888)) ([e8f1501](https://github.com/northMES/northmes/commit/e8f15015ef0964e03f382092107b7a5a64452afc))
* **planning:** the Gantt's tree columns stay in view after the time range grows ([#912](https://github.com/northMES/northmes/issues/912)) ([b5daec3](https://github.com/northMES/northmes/commit/b5daec377054f49eef4a91e2132d4653cfbe7746))
* **planning:** the Gantt's tree pane sticks as one block with a splitter and scrolls on its own ([#947](https://github.com/northMES/northmes/issues/947)) ([2066c69](https://github.com/northMES/northmes/commit/2066c69f8837253192247d00ce95e7254bf17b76))
* **planning:** the time area no longer shows through the left pane on each row's bottom border ([#956](https://github.com/northMES/northmes/issues/956)) ([f2abb80](https://github.com/northMES/northmes/commit/f2abb8095eb5ec462f20e2f05ffb6fc8caff0585))
* **planning:** the workload labels and the board's machine column stay in view on a wide time area ([#924](https://github.com/northMES/northmes/issues/924)) ([0490099](https://github.com/northMES/northmes/commit/0490099b8073b678f821cec444540471c5726b53))
* **web:** Dashboard is marked current on its own page only, not on every page of the plant ([#877](https://github.com/northMES/northmes/issues/877)) ([6e4a114](https://github.com/northMES/northmes/commit/6e4a114747ea07a40d9686e780e4960e94a7f01d))
* **web:** every settings page opens under /&lt;plant&gt;/settings, the company's pages included ([#905](https://github.com/northMES/northmes/issues/905)) ([7c8c4c2](https://github.com/northMES/northmes/commit/7c8c4c24c6378440920523d5dc78f6cc8641d2c1))
* **web:** Group by and Columns move from the list toolbars into the table header ([#880](https://github.com/northMES/northmes/issues/880)) ([5f99377](https://github.com/northMES/northmes/commit/5f99377becf5152b268332b155663767d1091f9d))
* **web:** land on your plant, company settings or plant list after sign-in instead of Page not found ([#651](https://github.com/northMES/northmes/issues/651)) ([453cbfe](https://github.com/northMES/northmes/commit/453cbfeacee459b4d4b7cf1451ce8ec9af14095a))
* **web:** old URLs from before a page moved show not found instead of redirecting ([#951](https://github.com/northMES/northmes/issues/951)) ([f36baef](https://github.com/northMES/northmes/commit/f36baef20370205358c73745c5e1af0d8d1dd2ff))
* **web:** sign-in lands on the user's one plant, and several plants get a picker ([#879](https://github.com/northMES/northmes/issues/879)) ([c10142a](https://github.com/northMES/northmes/commit/c10142a3e46a44757c868ed06b1bb3146cac7467))
* **web:** the company's settings end the plant settings navigation as a group, and its landing leads on ([#881](https://github.com/northMES/northmes/issues/881)) ([43e333d](https://github.com/northMES/northmes/commit/43e333de3127fbb14500d53cf6326be92459b231))
* **web:** the record pages space their sections, blocks and footnote 16 px apart ([#878](https://github.com/northMES/northmes/issues/878)) ([b919b9e](https://github.com/northMES/northmes/commit/b919b9ee6d3df683fe4d672ef6d02505b75b7096))


### Performance Improvements

* **planning:** the Gantt's drag preview runs outside React's render path ([#916](https://github.com/northMES/northmes/issues/916)) ([5a2584b](https://github.com/northMES/northmes/commit/5a2584b16342b28b83822205370f869c3b14497a))

## [0.1.0](https://github.com/northMES/northmes/compare/v0.0.1...v0.1.0) (2026-10-16)


### Features

* **core:** end a session after 24 hours and end its JWTs at sign-out ([#592](https://github.com/northMES/northmes/issues/592)) ([62a000d](https://github.com/northMES/northmes/commit/62a000dca6dab940c80eb2ef59c8f50b35c83c7b))
* **core:** throttle sign-in per client and lock an account after failed sign-ins ([#597](https://github.com/northMES/northmes/issues/597)) ([0f6b4b9](https://github.com/northMES/northmes/commit/0f6b4b926e54468af1b6ec81f4a5e96a34e35e9d))
* **core:** write article events to the event log ([#571](https://github.com/northMES/northmes/issues/571)) ([b0f4341](https://github.com/northMES/northmes/commit/b0f4341cba2f04eb6337d634e8d3590d6c8543e2))
* **deploy:** back up through an opt-in Compose profile and prove the restore in CI ([#594](https://github.com/northMES/northmes/issues/594)) ([eef3757](https://github.com/northMES/northmes/commit/eef3757dd526f648384e6700673e7df53377bc83))
* **deploy:** run NorthMES on a Postgres server of your own ([#567](https://github.com/northMES/northmes/issues/567)) ([2cf9923](https://github.com/northMES/northmes/commit/2cf9923888ebb75a5c80d766991f5784b1e7d5ce))
* **deploy:** run the NorthMES containers read-only with no capabilities ([#583](https://github.com/northMES/northmes/issues/583)) ([a0339c1](https://github.com/northMES/northmes/commit/a0339c1d2d6289ca324d077eb3fec0124456ebae))
* **docs:** claim the northmes/northmes library on Context7 ([#585](https://github.com/northMES/northmes/issues/585)) ([0e7356f](https://github.com/northMES/northmes/commit/0e7356f9630a2770476b942b9cfc55b0d1273145))
* **examples:** add an article log example plugin ([#580](https://github.com/northMES/northmes/issues/580)) ([67672a5](https://github.com/northMES/northmes/commit/67672a5244e46573a4e0cb649167a48e297e0641))
* **plugins:** build and serve plugin web parts, and list the plugins with screens ([#596](https://github.com/northMES/northmes/issues/596)) ([1e91e2f](https://github.com/northMES/northmes/commit/1e91e2fac4341009c4096a67b0c04e489efbca35))
* **plugins:** run event consumers on pg-boss ([#578](https://github.com/northMES/northmes/issues/578)) ([fe15e3d](https://github.com/northMES/northmes/commit/fe15e3d5ec3685ee4e3c2ff0eca69d43fca40d2b))
* **repo:** add the draft contributor license agreements and a CLA check ([#620](https://github.com/northMES/northmes/issues/620)) ([fa7cc5d](https://github.com/northMES/northmes/commit/fa7cc5dc762ce7f7782ae018253d26fb25513802))
* **web:** load plugin screens at run time, with a sidebar page example ([#598](https://github.com/northMES/northmes/issues/598)) ([d4eb457](https://github.com/northMES/northmes/commit/d4eb4573802f2b41810f0880a3bccb1617dfc2ef))
* **web:** show plugin widgets on the dashboard, with an article count example ([#602](https://github.com/northMES/northmes/issues/602)) ([0a3914c](https://github.com/northMES/northmes/commit/0a3914c9952dfb7c9e3950d869c20f4798982fb8))


### Bug Fixes

* **core:** close every Better Auth route the web does not call ([#595](https://github.com/northMES/northmes/issues/595)) ([7adcd46](https://github.com/northMES/northmes/commit/7adcd462eab5b91a030e3c0c34ce78fa27b7e31a))
* **core:** refuse weak auth secrets and seeded dev users in production, and rotate JWT keys ([#593](https://github.com/northMES/northmes/issues/593)) ([59bef37](https://github.com/northMES/northmes/commit/59bef37b3c4fac7d38ecdea0735ff7734620d807))
* **deps:** raise shell-quote, source-map-js and the MCP SDK packages to fixed versions ([#590](https://github.com/northMES/northmes/issues/590)) ([3036313](https://github.com/northMES/northmes/commit/3036313da2d451435043f7d650a5a8d47b7edd13))
* **image:** pin pnpm in the image build and record the accepted braces advisory for Scorecard ([#603](https://github.com/northMES/northmes/issues/603)) ([9370927](https://github.com/northMES/northmes/commit/93709278d0919a9ccf5da3e5965303cde7183688))
* **planning:** check core.article:read on a production order's article ([#600](https://github.com/northMES/northmes/issues/600)) ([e78b5cd](https://github.com/northMES/northmes/commit/e78b5cdee0d4907e8ddf8b90caa80cb65d148f51))
* **planning:** check planning.productionOrder:read on the production order list ([#587](https://github.com/northMES/northmes/issues/587)) ([e1ee8aa](https://github.com/northMES/northmes/commit/e1ee8aabf0e30314961f695d5bb3b509513b53b1))
* **plugins:** let the example plugins run on every 0.x release ([#633](https://github.com/northMES/northmes/issues/633)) ([cb4d5de](https://github.com/northMES/northmes/commit/cb4d5de6dfe57413707e4e7d0eb3fcb0ceca14bb))

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
