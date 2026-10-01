/* Parser gate for cross-document view transitions — intentionally empty.

   Chromium resolves the incoming page's `@view-transition` opt-in at the moment
   the parser inserts <body>. styles.css holds that opt-in; a stylesheet blocks
   rendering but not parsing, so whenever it has to be fetched or revalidated
   (production serves it with max-age=0) the parser reaches <body> first and the
   navigation is skipped with "InvalidStateError: ViewTransition opt-in disabled".

   A classic external script waits for the stylesheets before it, so loading this
   file directly after the styles.css <link> holds the parser until the opt-in is
   known. It must stay a synchronous <script src> in <head> (no async / defer). */
