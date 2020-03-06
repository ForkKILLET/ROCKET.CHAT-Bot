// ==UserScript==
// @name         ROCKET.CHAT bot
// @namespace    http://tampermonkey.net/
// @version      0.1.20200306
// @description  A foolish bot for ROCKET.CHAT.
// @author       ForkKILLET
// @match        https://2.masnn.io:31234/*
// @match        https://chat.solariar.tech:31234/*
// @grant        GM_getValue
// @grant        GM_setValue
// @homepage     http://icelava.top
// ==/UserScript==

Object.assign(window,
{
    is_empty: v => v === null || v === undefined,
    is_callable: v => typeof v === "function",
    is_array: v => Array.isArray(v),
    channel_id: () => $(".sidebar-item--active").data("id")
});

window.ForkKILLET_Data = class ForkKILLET_Data
{
    constructor() {}
    set(n, v) { GM_setValue(n, v); }
    get(n) { return GM_getValue(n, null); }
    record(n, d)
    {
        this[n] = (v) => is_empty(v) ? this.get(n) : this.set(n, v);
        if (!is_empty(d)) this[n](d);
    }
};

window.ForkKILLET_Bot = class ForkKILLET_Bot
{
    constructor(name, un)
    {
        this.name = name;
        this.un = un;
        this.processers = {};

        this.d = new ForkKILLET_Data();
        this.d.record("recent_msg_ids", {});
        this.d.record("msg_level_filter");
        this.d.record("permission_list", { "forkkillet": "owner" });

        this.paint();

        this.define_processer("log_msg", p => console.log(p.msg), true);
        this.define_processer("try_exec", p =>
        {
            let permission_list = this.d.permission_list(), t;
            if (is_empty(permission_list[p.un]))
            {
                permission_list[p.un] = "normal";
                this.d.permission_list(permission_list);
            }
            t = p.msg.matchAll(/(^f\$ |f# )/g).next();
            if (!t.done) this.exec(p.msg.substr(t.value.index + 3) + " ", this.d.permission_list()[p.un]);
        }, true);
        this.define_processer("smart_repeat", (p, ps, i) =>
        {
            if (ps.length < 4) return;
            let eq0 = p.msg === ps[i - 1].msg, eq1 = ps[i - 1].msg === ps[i - 2].msg, eq2 = ps[i - 2].msg === ps[i - 3].msg;
            if (eq0) { if (eq1 && eq2 && p.un !== this.un && ps[i - 1].un !== this.un) this.say(p.msg, "WATER"); }
            else if (eq1 && eq2) this.say(`@${p.un}，你为什么打断复读（不是）`, "WATER");
        });
    }

    paint()
    {
        $("div.sidebar__header-thumb").after(`
<button class="_bot_button sidebar__toolbar-button rc-tooltip rc-tooltip--down js-button">
    <p>Bot</p>
</button>`);
        let $toolbar = $(".sidebar__toolbar");
        $toolbar.after(`
<div class="_bot_menu">
    <p class="_bot_menu_item _bot_menu_item_log">log</p>
</div>`);
        let $menu_bot = $("._bot_menu");
        $menu_bot.hide();

        let $btn_bot = $("._bot_button"), $btn_and_menu_bot = $("._bot_button, ._bot_menu");
        $btn_bot.click(() =>
        {
            $btn_bot.toggleClass("on");
            if ($btn_bot.is(".on"))
            {
                this.me("is lauched...", "INFO");
                this.say(`Last read msg id "${this.d.recent_msg_ids()[channel_id()]}".`);
                this.listen();
            }
            else
            {
                this.me("is killed...", "INFO");
                this.listen(false);
            }
        });
        $btn_and_menu_bot.mousedown((evt) =>
        {
            if (evt.which == 3)
            {
                evt.preventDefault();
                $toolbar.toggle(); $menu_bot.toggle();
            }
        }).contextmenu(() => false);

        let $item_log = $("._bot_menu_item_log"), _udf = () => $item_log.attr("data-filter", this.d.msg_level_filter().toString());
        if (is_empty(this.d.msg_level_filter())) this.d.msg_level_filter(0);
        _udf();
        $item_log.click(() =>
        {
            this.d.msg_level_filter((this.d.msg_level_filter() + 1) % 6);
            _udf();
        });
    }
    
    fill(msg)
    {
        $("textarea.rc-message-box__textarea").val(msg);
    }
    send()
    {
        let evt = $.Event("keydown");
        evt.which = 13;
        $("textarea.rc-message-box__textarea").trigger(evt);
    }

    say(msg, level = "MSG")
    {
        let n_level = ["MSG", "INFO", "WARN", "ERROR", "FATEL", "WATER"].indexOf(level);
        if (n_level < this.d.msg_level_filter()) return;
        // Disable: this.set_msg(`$\\color{${["#000000", "#2de0a5", "#ffd21f", "#f5455c", "#f70ada", "#000000"][n_level]}}\\texttt{${level === "WATER" ? "" : `[${level}]`}${msg}}$`);
        this.fill((level === "WATER" ? "" : `[${level}] `) + msg);
        this.send();
    }
    me(msg, level)
    {
        this.say(`${this.name} ${msg}`, level);
    }
    
    define_processer(name, callback, if_immediate = false) { this.processers[name] = { callback: callback, if_work: if_immediate }; }
    enable_processer(name) { if (this.processers[name]) this.processers[name].if_work = true; }
    disable_processer(name) { if (this.processers[name]) this.processers[name].if_work = false; }
    toggle_processer(name) { if (this.processers[name]) this.processers[name].if_work = !this.processers[name].if_work; }

    listen(if_work = true)
    {
        if (this.listen_poll_id)
        {
            clearInterval(this.listen_poll_id);
            console.log("Bot listener resets.");
        }
        if (if_work)
        {
            let ps = [];
            this.me("starts listening...");
            this.listen_poll_id = setInterval(() =>
            {
                let $recent_msg, recent_msg_ids, p = {}, i, f = false;
                if (this.d.recent_msg_ids()[channel_id()]) $recent_msg = $(`.messages-box>.wrapper>ul>li[data-id="${this.d.recent_msg_ids()[channel_id()]}"]`).next();
                if (!$recent_msg) $recent_msg = $(".messages-box>.wrapper>ul>li:last-child");
                if (!$recent_msg.length) return; // Note: 没有新的消息，爬！
                for (; $recent_msg.length; $recent_msg = $recent_msg.next())
                {
                    recent_msg_ids = this.d.recent_msg_ids();
                    recent_msg_ids[channel_id()] = $recent_msg.data("id");
                    this.d.recent_msg_ids(recent_msg_ids);
                    p.msg = $recent_msg.find(">.message-body-wrapper>.body").text().replace(/(^\s+)|(\s+$)/g, "");
                    p.un = $recent_msg.data("username");
                    i = ps.length;
                    ps.push(p);
                }

                for (let j in this.processers) if (this.processers[j].if_work) this.processers[j].callback(p, ps, i);
                // Note: 把功能交给处（挂）理（件）器实现。
            }, 800);
        }
        else
        {
            this.me("stops listening...");
            this.listen_poll_id = null;
        }
    }

    exec(instruction, permission)
    {
        let fields = instruction.split(/ +/), instruction_list =
        {
            "help":
            {
                "": ["normal", () => this.say("窝是 ForkKILET 写的 Bot 喵~\n你可以用 `f$ ` 开头的命令喊我喵~\n可用命令：`help`, `suicide`, `orz`, `point`, `repeat`\n命令格式的格式：`{}` 代表参数, `[]` 代表可选参数，参数请用`\"`包裹。", "WATER")],
                "help": ["normal", () => this.say("`f$ help [instruction name]`\n本 Bot 的帮助系统喵~ 你想要了解什么都可以问的喵~", "WATER")],
                "suicide": ["normal", () => this.say("`f$ suicide`\n“我真的不想像个 Lancer 一样自 —— 啊！”（当然如果你不是我的 master 的话那是没用的喵~）", "WATER")],
                "orz":  ["normal", () => this.say("`f$ orz {username}`\n通过这个指令你可以很方便地膜拜一个大佬！", "WATER")],
                "point":  ["normal", () => this.say("`f$ point {username} {permission}`\n设（钦）置（点）一个用户的权限等级。\n`f$ point show {username}`\n显示一个用户的权限等级。", "WATER")],
                "repeat": ["normal", () => this.say("`f$ repeat start`\n开启智能复读的万恶魔盒！\n`f$ repeat stop`\n不顾众人阻拦摔烂复读机。", "WATER")]
            },
            "suicide": ["owner", () =>
            {
                this.say("啊我死了（确信）", "WATER");
                $("._bot_button.on").click()
            }],
            "orz":
            {
                _: ["normal", u =>
                {
                    u = u.toLowerCase();
                    switch(u)
                    {
                    case "forkkillet":
                        this.say("ForkKILLET 太菜了，你不能膜拜他！", "WATER");
                        return;
                    case "masnn":
                        this.say("Masnnb txdy!", "WATER");
                        break;
                    case "water_lift":
                        this.say("水电梯是世界上最快的……电梯。", "WATER");
                        break;
                    case "jelly_goat":
                        this.say("小金羊！小金鸽！小金人！", "WATER");
                        break;
                    }
                    this.say(`%%% sto @${u} orz TQL\n@${u} AKs IOI every day!!!`, "WATER");
                }]
            },
            "point":
            {
                _:
                {
                    "show": ["normal", u =>
                    {
                        let permission_list = this.d.permission_list();
                        if (permission_list[u]) this.say(`${u} 的权限等级为 \`${permission_list[u]}\``, "WATER");
                        else this.say("爬，没这人！", "WATER");
                    }],
                    _: ["owner", (u, p) =>
                    {
                        let permission_list = this.d.permission_list();
                        permission_list[u] = p;
                        this.d.permission_list(permission_list);
                        if (!p.match(/exiled|normal|admin|owner/)) this.say("不支持的权限等级！", "WATER");
                        else this.say(`已将 @${u} 的权限等级设置为 \`${p}\`。`, "WATER");
                    }]
                }
            },
            "repeat":
            {
                "start": ["admin", () => { this.say("已开启智能复读！", "WATER"); this.enable_processer("smart_repeat"); }],
                "stop": ["admin", () => { this.say("一位群友及时摔坏了复读机！", "WATER"); this.disable_processer("smart_repeat"); }],
                _: ["admin", u => {  }]
            }
        }, now = instruction_list, params = [], pl = ["exiled", "normal", "admin", "owner"];
        for (let i = 0; !is_array(now); i++)
        {
            if (fields[i].match(/^".+"$/))
            {
                now = now._;
                params.push(fields[i].substring(1, fields[i].length - 1));
            }
            else if (is_empty(now[fields[i]]))
            {
                this.say("不支持的命令格式！", "WATER");
                break;
            }
            else now = now[fields[i]];
        }
        if (is_array(now))
        {
            if (pl.indexOf(permission) < pl.indexOf(now[0])) this.say("你没有权限执行此命令！", "WATER");
            else now[1](...params);
        }
    }
}

$(() =>
{
    $("head").append(`
<style>
._bot_button.on
{
    color: #2de0a5;
}
._bot_menu
{
    background-color: #414852;
    padding: 3px;
    border-radius: 5px;
}
._bot_menu_item
{
    color: #9ea2a8;
    cursor: pointer;
}
._bot_menu_item_log[data-filter="0"] /* MSG */
{
    color: #9ea2a8;
    cursor: pointer;
}
._bot_menu_item_log[data-filter="1"] /* INFO */
{
    color: #2de0a5;
    cursor: pointer;
}
._bot_menu_item_log[data-filter="2"] /* WARN */
{
    color: #ffd21f;
    cursor: pointer;
}
._bot_menu_item_log[data-filter="3"] /* ERROR */
{
    color: #f5455c;
    cursor: pointer;
}
._bot_menu_item_log[data-filter="4"] /* FATEL */
{
    color: #f70ada;
    cursor: pointer;
}
._bot_menu_item_log[data-filter="5"] /* WATER */
{
    color: #1d74f5;
    cursor: pointer;
}
</style>`);
    let i = setInterval(() =>
    {
        if ($("header.sidebar__header").length)
        {
            window.fb = new ForkKILLET_Bot("Bot by ForkKILLET", "forkkillet");
            clearInterval(i);
        }
    }, 500);
});