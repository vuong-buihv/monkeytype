import * as Loader from "./loader";
import * as CloudFunctions from "./cloud-functions";
import * as Notifications from "./notifications";
import * as AccountController from "./account-controller";
import * as DB from "./db";
import * as Settings from "./settings";

export let list = {};
class SimplePopup {
  constructor(
    id,
    type,
    title,
    inputs = [],
    text = "",
    buttonText = "Confirm",
    execFn,
    beforeShowFn
  ) {
    this.parameters = [];
    this.id = id;
    this.type = type;
    this.execFn = execFn;
    this.title = title;
    this.inputs = inputs;
    this.text = text;
    this.wrapper = $("#simplePopupWrapper");
    this.element = $("#simplePopup");
    this.buttonText = buttonText;
    this.beforeShowFn = beforeShowFn;
  }
  reset() {
    this.element.html(`
    <div class="title"></div>
    <div class="inputs"></div>
    <div class="text"></div>
    <div class="button"></div>`);
  }

  init() {
    let el = this.element;
    el.find("input").val("");
    // if (el.attr("popupId") !== this.id) {
    this.reset();
    el.attr("popupId", this.id);
    el.find(".title").text(this.title);
    el.find(".text").text(this.text);

    this.initInputs();

    el.find(".button").text(this.buttonText);
    // }
  }

  initInputs() {
    let el = this.element;
    if (this.inputs.length > 0) {
      if (this.type === "number") {
        this.inputs.forEach((input) => {
          el.find(".inputs").append(`
        <input type="number" min="1" val="${input.initVal}" placeholder="${input.placeholder}" required>
        `);
        });
      } else if (this.type === "text") {
        this.inputs.forEach((input) => {
          el.find(".inputs").append(`
        <input type="text" val="${input.initVal}" placeholder="${input.placeholder}" required>
        `);
        });
      }
      el.find(".inputs").removeClass("hidden");
    } else {
      el.find(".inputs").addClass("hidden");
    }
  }

  exec() {
    let vals = [];
    $.each($("#simplePopup input"), (index, el) => {
      vals.push($(el).val());
    });
    this.execFn(...vals);
    this.hide();
  }

  show(parameters) {
    this.parameters = parameters;
    this.beforeShowFn();
    this.init();
    this.wrapper
      .stop(true, true)
      .css("opacity", 0)
      .removeClass("hidden")
      .animate({ opacity: 1 }, 125, () => {
        $($("#simplePopup").find("input")[0]).focus();
      });
  }

  hide() {
    this.wrapper
      .stop(true, true)
      .css("opacity", 1)
      .removeClass("hidden")
      .animate({ opacity: 0 }, 125, () => {
        this.wrapper.addClass("hidden");
      });
  }
}

$("#simplePopupWrapper").click((e) => {
  if ($(e.target).attr("id") === "simplePopupWrapper") {
    $("#simplePopupWrapper")
      .stop(true, true)
      .css("opacity", 1)
      .removeClass("hidden")
      .animate({ opacity: 0 }, 125, () => {
        $("#simplePopupWrapper").addClass("hidden");
      });
  }
});

$(document).on("click", "#simplePopupWrapper .button", (e) => {
  let id = $("#simplePopup").attr("popupId");
  list[id].exec();
});

$(document).on("keyup", "#simplePopupWrapper input", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    let id = $("#simplePopup").attr("popupId");
    list[id].exec();
  }
});

list.updateEmail = new SimplePopup(
  "updateEmail",
  "text",
  "Update Email",
  [
    {
      placeholder: "Current email",
      initVal: "",
    },
    {
      placeholder: "New email",
      initVal: "",
    },
  ],
  "Don't mess this one up or you won't be able to login!",
  "Update",
  (previousEmail, newEmail) => {
    try {
      Loader.show();
      CloudFunctions.updateEmail({
        uid: firebase.auth().currentUser.uid,
        previousEmail: previousEmail,
        newEmail: newEmail,
      }).then((data) => {
        Loader.hide();
        if (data.data.resultCode === 1) {
          Notifications.add("Email updated", 0);
          setTimeout(() => {
            AccountController.signOut();
          }, 1000);
        } else if (data.data.resultCode === -1) {
          Notifications.add("Current email doesn't match", 0);
        } else {
          Notifications.add(
            "Something went wrong: " + JSON.stringify(data.data),
            -1
          );
        }
      });
    } catch (e) {
      Notifications.add("Something went wrong: " + e, -1);
    }
  },
  () => {}
);

list.clearTagPb = new SimplePopup(
  "clearTagPb",
  "text",
  "Clear Tag PB",
  [],
  `Are you sure you want to clear this tags PB?`,
  "Clear",
  () => {
    let tagid = eval("this.parameters[0]");
    Loader.show();
    CloudFunctions.clearTagPb({
      uid: firebase.auth().currentUser.uid,
      tagid: tagid,
    })
      .then((res) => {
        Loader.hide();
        if (res.data.resultCode === 1) {
          let tag = DB.getSnapshot().tags.filter((t) => t.id === tagid)[0];
          tag.pb = 0;
          $(
            `.pageSettings .section.tags .tagsList .tag[id="${tagid}"] .clearPbButton`
          ).attr("aria-label", "No PB found");
          Notifications.add("Tag PB cleared.", 0);
        } else {
          Notifications.add("Something went wrong: " + res.data.message, -1);
        }
      })
      .catch((e) => {
        Loader.hide();
        Notifications.add(
          "Something went wrong while clearing tag pb " + e,
          -1
        );
      });
    // console.log(`clearing for ${eval("this.parameters[0]")} ${eval("this.parameters[1]")}`);
  },
  () => {
    eval(
      "this.text = `Are you sure you want to clear PB for tag ${eval('this.parameters[1]')}?`"
    );
  }
);

list.applyCustomFont = new SimplePopup(
  "applyCustomFont",
  "text",
  "Custom font",
  [{ placeholder: "Font name", initVal: "" }],
  "Make sure you have the font installed on your computer before applying.",
  "Apply",
  (fontName) => {
    if (fontName === "") return;
    Settings.groups.fontFamily.setValue(fontName.replace(/\s/g, "_"));
  },
  () => {}
);

list.resetPersonalBests = new SimplePopup(
  "resetPersonalBests",
  "text",
  "Reset Personal Bests",
  [],
  "Are you sure you want to reset all your personal bests?",
  "Reset",
  () => {
    try {
      Loader.show();

      CloudFunctions.resetPersonalBests({
        uid: firebase.auth().currentUser.uid,
      }).then((res) => {
        if (res) {
          Loader.hide();
          Notifications.add(
            "Personal bests removed, refreshing the page...",
            0
          );
          setTimeout(() => {
            location.reload();
          }, 1500);
        } else {
          Notifications.add(
            "Something went wrong while removing personal bests...",
            -1
          );
        }
      });
    } catch (e) {
      Notifications.add("Something went wrong: " + e, -1);
    }
  },
  () => {}
);
