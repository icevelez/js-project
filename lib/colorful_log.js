const text_color = {
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37
};

const background_color = {
    black: 40,
    red: 41,
    green: 42,
    yellow: 43,
    blue: 44,
    magenta: 45,
    cyan: 46,
    white: 47
};

export class Logger {

    #texts = [];
    #selected_text_color = "";
    #selected_background_color = "";

    constructor() { }

    /**
     * @param {keyof typeof text_color} key
     */
    color = (key) => {
        this.#selected_text_color = text_color[key || "white"] || 37;
        return this;
    }

    /**
     * @param {keyof typeof background_color} key
     */
    bgColor = (key) => {
        this.#selected_background_color = background_color[key || "white"] || 37;
        return this;
    }

    /**
     * @param {string} text
     */
    append = (text) => {
        this.#texts.push(`\x1b[${this.#selected_text_color || this.#selected_background_color}m${text}\x1b[0m`);
        return this;
    }

    log = () => {
        console.log(`${this.#texts.join("")}`);
        return this;
    }

    reset = () => {
        this.#selected_background_color = this.#selected_text_color = "";
        return this;
    }

    clear = () => {
        this.#texts.length = 0;
        return this;
    }
}
