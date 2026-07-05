// ES-модуль-обёртка: движок регистрируется в window.SkinEngine (side effect)
// и одновременно экспортируется по умолчанию.
import "./skin-engine.anims.js";
import "./skin-engine.js";
export default window.SkinEngine;
