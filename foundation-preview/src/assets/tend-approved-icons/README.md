# Tend approved icon concept

SVG set based on Lucide 0.468.0 (ISC; license included), with simple replacement Cross and Dollar-sign symbols.

Use categories/ and foundations/ as the production source symbols: 24×24 viewBox, currentColor, no embedded container. Category symbols use heavier 2.5 strokes and a 12% currentColor fill except Faith and Finances, which use unfilled 2.5 strokes; Marriage uses a solid heart with 1.5 stroke. Foundation symbols use unfilled 1.5 strokes.

Wrap Category symbols in mint rounded squares; wrap Foundation symbols in white/neutral outlined circles. Match existing badge sizes and touch targets rather than enlarging production badges. Colors and surfaces must follow Tend theme tokens.

badge-previews/ contains 48px self-contained light-mode references only. Do not nest these inside another badge container or hardcode their light colors into production dark mode. The approved board showed approximately 25px Category and 24px Foundation symbols inside 48px examples; production Rhythm badges use existing compact sizes.

Mappings are in manifest.json. Preserve all stable Category/Foundation IDs; filenames are asset labels, not schema changes. Faith simple Christian cross (not a church or medical cross), Marriage heart, Parenting house, Health & Fitness activity, Finances dollar sign (not a wallet or enclosing coin), Friendships users-round. Connection link, Communication messages-square, Fun & Adventure compass, Spiritual Growth sprout, Partnership handshake, Intimacy heart-handshake.

Parenting Foundation IDs reuse the approved link, messages-square, sprout and compass outlines where their meanings match. `parenting-fun-memories` (sparkles) and `parenting-encouragement-affirmation` (heart-plus) are original compact SVGs created for this preview; they are not sourced from Lucide.

Faith Practice IDs use original 24×24 outline SVGs created for this preview: `faith-sabbath` sunrise, `faith-prayer` praying hands, `faith-fasting` plate and cutlery, `faith-solitude` mountain, `faith-generosity` open hand and heart, `faith-community` people together, `faith-service` helping hand, `faith-witness` speech bubble and cross, and `faith-scripture` open book. These original assets use currentColor and the same 1.6px outline family; the Lucide license applies to the Lucide-derived assets, not these originals.

Revision: Faith is a simple Christian cross (not a church or medical cross). Finances is a bare $ symbol (no wallet or enclosing coin). Both use unfilled 2.5 strokes.
