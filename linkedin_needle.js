/* version: 1.005 */
require("dotenv").load();
var tress = require("tress");
var cheerio = require("cheerio");
var needle = require("needle");
var moment = require("moment");
var fs = require("fs");
var log = require("debug")("Info:");
var log_err = require("debug")("Error:");
var events = require("events");
var util = require("util");
var request = require("request");

log.color = 6;
log_err.color = 2;

webdriver = require("selenium-webdriver");
proxy = require("selenium-webdriver/proxy");
chrome = require("selenium-webdriver/chrome");
By = webdriver.By;
until = webdriver.until;
path = require("chromedriver").path;
service = new chrome.ServiceBuilder(path).build();
chrome.setDefaultService(service);

/* Waiting timers */

var between_functions = 3000;
var between_actions = 100;
var number_of_instances = 10;

//var functions = ['geturl','privacy','details','avatar','experience','education','skillset','changepw','invitesettings','acceptinvites']
var functions = ["details"];

botdb = fs
  .readFileSync("linkedin-setup-input.csv", "utf-8")
  .split("\r\n")
  .filter(Boolean);

console.log(botdb);

botdb.forEach(function (cur, ind, arr) {
  var tmp = arr[ind].split(",");
  arr[ind] = {
    proxy: tmp[0],
    port: tmp[1],
    email: tmp[2],
    name: tmp[3],
    pass: tmp[4],
    passMail: tmp[5],
    img: tmp[6],
    zip: tmp[7],
    firstname: tmp[8],
    lastname: tmp[9],
    cookies: "",
    csrf: ""
  };
});

var screen = 0;
if (process.argv.indexOf("urlonly") !== -1) {
  functions = [];
}

companies = fs
  .readFileSync("linkedin-db-companies.csv", "utf-8")
  .split("\r\n")
  .filter(Boolean);

schools = fs
  .readFileSync("linkedin-db-edu-schools.csv", "utf-8")
  .split("\r\n")
  .filter(Boolean);

studies = fs
  .readFileSync("linkedin-db-edu-studies.csv", "utf-8")
  .split("\r\n")
  .filter(Boolean);

jobdates = fs
  .readFileSync("linkedin-db-jobdates.csv", "utf-8")
  .split("\r\n")
  .filter(Boolean);

jobtitles = fs
  .readFileSync("linkedin-db-jobtitles.csv", "utf-8")
  .split("\r\n")
  .filter(Boolean);

skills = fs
  .readFileSync("linkedin-db-skills.csv", "utf-8")
  .split("\r\n")
  .filter(Boolean);

var bots = tress(function (bot, callback) {
  fs.writeFile(
    `bot${botdb.indexOf(bot) + 1}.lock`,
    { encoding: "utf-8" },
    function (err) {
      if (err) {
        log_err(err);
      }
    }
  );

  var login_tries = 0;
  var login_done = false;
  var tag = "";
  var mail_max = 0;
  var profileLink = "";
  var errors = 0;
  var called = false;
  var fstart = 0;
  var invites_accepted = 0;

  var options = {
    compressed: true,
    rejectUnauthorized: false,
    open_timeout: 10000,
    response_timeout: 10000,
    read_timeout: 10000,
    proxy: bot.proxy + ":" + bot.port
  };

  var options_2 = {
    compressed: true,
    rejectUnauthorized: false,
    follow_max: 5,
    follow_set_cookies: true,
    open_timeout: 10000,
    response_timeout: 10000,
    read_timeout: 10000,
    proxy: bot.proxy + ":" + bot.port
  };

  options["headers"] = {
    authority: "www.linkedin.com",
    method: "POST",
    path: "/checkpoint/lg/login-submit",
    scheme: "https",
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
    "accept-encoding": "gzip, deflate, br",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "max-age=0",
    "content-type": "application/x-www-form-urlencoded",
    origin: "https://www.linkedin.com",
    referer:
      "https://www.linkedin.com/login?trk=guest_homepage-basic_nav-header-signin",
    "upgrade-insecure-requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36"
  };

  log(`Logging in Bot #${botdb.indexOf(bot) + 1} - ${bot.email}`);
  writeLog(`Logging in Bot #${botdb.indexOf(bot) + 1} - ${bot.email}`, "Info:");
  login();

  function login() {
    login_tries++;

    if (login_tries >= 4) {
      log(
        `Login failed on Bot #${botdb.indexOf(bot) + 1} (${
        bot.name
        } <-> Proxy error)`,
        "Error"
      );
      fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, function () { });
      botsActive.splice(botsActive.indexOf(bot), 1);
      skippedBots(botdb.indexOf(bot));
      callback();
      return;
    }

    var url =
      "https://www.linkedin.com/login?trk=guest_homepage-basic_nav-header-signin";

    needle.get(url, options, function (err, resp) {
      fs.writeFileSync("ttest.html", resp.body, function () { });

      if (err == null && resp.statusCode === 200) {
        var $ = cheerio.load(resp.body);

        var csrf = $('input[name="loginCsrfParam"]').attr("value");
        var ck = resp.cookies;

        options["cookies"] = ck;

        fs.writeFileSync("ttest.html", resp.body, function () { });

        var url = "https://www.linkedin.com/checkpoint/lg/login-submit";

        if (options["cookies"] == undefined) {
          login();
          return;
        }

        needle.post(
          url,
          {
            session_key: bot.email,
            session_password: bot.pass,
            isJsEnabled: false,
            loginCsrfParam: csrf
          },
          options,
          async function (err, resp) {
            if (
              err == null &&
              (resp.statusCode === 302 ||
                resp.statusCode == 303 ||
                resp.statusCode === 200)
            ) {
              var $ = cheerio.load(resp.body);

              if ($("#challengeContent").length !== 0) {
                log_err(
                  `Captcha! Solving for bot #${botdb.indexOf(bot) + 1} - ${
                  bot.email
                  }`
                );
                var ck = await solveCaptcha();
                if (ck !== false) {
                  record_cookie(ck, true);
                } else {
                  log_err(
                    `Error on login: captcha or wrong password, skipping the ${
                    bot.email
                    }`
                  );
                  if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
                    fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
                  }
                  skippedBots(botdb.indexOf(bot));
                  callback();
                  return;
                }
              } else if (
                $(`#idverifyUrl`).length !== 0 ||
                $(`#pagekey-uas-account-restricted`).length !== 0 ||
                resp.body.indexOf('href="/checkpoint/challenge/') !== -1 ||
                (resp.headers["location"] &&
                  resp.headers["location"].indexOf("/checkpoint/challenge/") !==
                  -1)
              ) {
                if (
                  resp.body.indexOf('href="/checkpoint/challenge/') !== -1 ||
                  (resp.headers["location"] &&
                    resp.headers["location"].indexOf(
                      "/checkpoint/challenge/"
                    ) !== -1)
                ) {
                  var loc = resp.headers["location"];

                  if (loc == undefined) {
                    log_err(
                      `Profile Banned! Skipping - ${
                      bot.email
                      } Bot #${botdb.indexOf(bot) + 1}`
                    );
                    writeLog(
                      `Profile Banned! Skipping - ${
                      bot.email
                      } Bot #${botdb.indexOf(bot) + 1}`,
                      "Error:"
                    );
                    if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
                      fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
                    }
                    skippedBots(botdb.indexOf(bot));
                    callback();
                    return;
                  }

                  options.cookies["chp_token"] = resp.cookies["chp_token"];

                  needle.get(
                    `https://www.linkedin.com${resp.headers["location"]}`,
                    options,
                    async function (err, resp) {
                      if (!resp && !resp.body) {
                        log_err(
                          `Nothing sent back for Bot #${botdb.indexOf(bot) +
                          1}, retrying`
                        );
                        writeLog(
                          `Nothing sent back for Bot #${botdb.indexOf(bot) +
                          1}, retrying`,
                          "Error:"
                        );
                        callback();
                        return;
                      }

                      if (resp.body.indexOf("captchaV2Challenge") !== -1) {
                        log_err(`Captcha! Solving - ${bot.email}`);
                        var ck = await solveCaptcha();
                        if (ck !== false) {
                          record_cookie(ck, true);
                          return;
                        } else {
                          log_err(
                            `Error on login: captcha or wrong password, skipping the ${
                            bot.email
                            }`
                          );
                          if (
                            fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)
                          ) {
                            fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
                          }
                          skippedBots(botdb.indexOf(bot));
                          callback();
                          return;
                        }
                      }

                      var $ = cheerio.load(resp.body);

                      var test = {
                        csrfToken: $('input[name="csrfToken"]').attr("value"),
                        pageInstance: $('meta[name="pageInstance"]').attr(
                          "content"
                        ),
                        resendUrl: "/checkpoint/challenge/resend",
                        challengeId: $('input[name="challengeId"]').attr(
                          "value"
                        ),
                        language: "en-US",
                        displayTime: $('input[name="displayTime"]').attr(
                          "value"
                        ),
                        challengeSource: $(
                          'input[name="challengeSource"]'
                        ).attr("value"),
                        requestSubmissionId: $(
                          'input[name="requestSubmissionId"]'
                        ).attr("value"),
                        challengeType: $('input[name="challengeType"]').attr(
                          "value"
                        ),
                        challengeData: $('input[name="challengeData"]').attr(
                          "value"
                        ),
                        failureRedirectUri: $(
                          'input[name="failureRedirectUri"]'
                        ).attr("value"),
                        pin: ""
                      };

                      if (
                        test.csrfToken == undefined ||
                        test.pageInstance == undefined ||
                        test.requestSubmissionId == undefined
                      ) {
                        log_err(
                          `General Error Login(or profile banned) - unknown LinkedIn error. Skipping Bot #${botdb.indexOf(
                            bot
                          ) + 1}`
                        );
                        writeLog(
                          `General Error Login(or profile banned) - unknown LinkedIn error. Skipping Bot #${botdb.indexOf(
                            bot
                          ) + 1}`,
                          "Error:"
                        );
                        skippedBots(botdb.indexOf(bot));
                        callback();
                        return;
                      }

                      log_err(
                        `Pin requested for Bot #${botdb.indexOf(bot) + 1}!`
                      );
                      writeLog(
                        `Pin requested for Bot #${botdb.indexOf(bot) + 1}!`,
                        "Error:"
                      );

                      var cnt = 0;
                      var pins = await mailconfirm();

                      pin_submit();

                      function pin_submit() {
                        var obj = {
                          csrfToken: $('input[name="csrfToken"]').attr("value"),
                          pageInstance: $('meta[name="pageInstance"]').attr(
                            "content"
                          ),
                          resendUrl: "/checkpoint/challenge/resend",
                          challengeId: $('input[name="challengeId"]').attr(
                            "value"
                          ),
                          language: "en-US",
                          displayTime: $('input[name="displayTime"]').attr(
                            "value"
                          ),
                          challengeSource: $(
                            'input[name="challengeSource"]'
                          ).attr("value"),
                          requestSubmissionId: $(
                            'input[name="requestSubmissionId"]'
                          ).attr("value"),
                          challengeType: $('input[name="challengeType"]').attr(
                            "value"
                          ),
                          challengeData: $('input[name="challengeData"]').attr(
                            "value"
                          ),
                          failureRedirectUri: $(
                            'input[name="failureRedirectUri"]'
                          ).attr("value"),
                          pin: pins[cnt]
                        };

                        options["headers"] = {
                          authority: "www.linkedin.com",
                          method: "POST",
                          path: "/checkpoint/challenge/verify",
                          scheme: "https",
                          accept:
                            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                          "accept-encoding": "gzip, deflate, br",
                          "accept-language":
                            "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
                          "cache-control": "max-age=0",
                          "content-type": "application/x-www-form-urlencoded",
                          origin: "https://www.linkedin.com",
                          referer: `https://www.linkedin.com${loc}`,
                          "upgrade-insecure-requests": "1",
                          "user-agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36"
                        };

                        options.follow_max = 5;
                        options.follow_set_cookies = true;

                        needle.post(
                          `https://www.linkedin.com/checkpoint/challenge/verify`,
                          obj,
                          options,
                          async function (err, resp) {
                            if (err == null && resp.statusCode === 200) {
                              var $ = cheerio.load(resp.body);

                              fs.writeFileSync(
                                "pintry.html",
                                resp.body,
                                function () { }
                              );

                              if (resp.body.indexOf('a href="/feed/"') == -1) {
                                if (resp.body.indexOf("verification") !== -1) {
                                  cnt++;
                                  if (cnt !== pins.length) {
                                    pin_submit();
                                  } else {
                                    log_err(
                                      `No more pins! Skipping Bot #${botdb.indexOf(
                                        bot
                                      ) + 1}`
                                    );
                                    writeLog(
                                      `No more pins! Skipping Bot #${botdb.indexOf(
                                        bot
                                      ) + 1}`,
                                      "Error:"
                                    );
                                    skippedBots(botdb.indexOf(bot));
                                    callback();
                                    return;
                                  }
                                } else {
                                  log(
                                    `Entered pin for Bot #${botdb.indexOf(bot) +
                                    1}, logging again`
                                  );
                                  writeLog(
                                    `Entered pin for Bot #${botdb.indexOf(bot) +
                                    1}, logging again`,
                                    "Info:"
                                  );
                                  delete options.follow_max;
                                  delete options.follow_set_cookies;
                                  login();
                                  return;
                                }
                              } else {
                                log(
                                  `Entered pin for Bot #${botdb.indexOf(bot) +
                                  1}, logging again`
                                );
                                writeLog(
                                  `Entered pin for Bot #${botdb.indexOf(bot) +
                                  1}, logging again`,
                                  "Info:"
                                );
                                delete options.follow_max;
                                delete options.follow_set_cookies;
                                login();
                                return;
                              }
                            } else {
                              log(
                                `Login for Bot #${botdb.indexOf(bot) +
                                1} complete! (${bot.email})`
                              );
                              writeLog(
                                `Login for Bot #${botdb.indexOf(bot) +
                                1} complete! (${bot.email})`,
                                "Info:"
                              );
                              login_done = true;
                              options.follow_max = 5;
                              options.follow_set_cookies = true;
                              streamline();
                            }
                          }
                        );
                      }

                      return;
                    }
                  );
                } else {
                  log_err(
                    `Profile Banned! Skipping - ${
                    bot.email
                    } Bot #${botdb.indexOf(bot) + 1}`
                  );
                  writeLog(
                    `Profile Banned! Skipping - ${
                    bot.email
                    } Bot #${botdb.indexOf(bot) + 1}`,
                    "Error:"
                  );
                  if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
                    fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
                  }
                  skippedBots(botdb.indexOf(bot));
                  callback();
                  return;
                }
              } else if ($(`#session_password-login-error`).length !== 0) {
                log_err(`Wrong Password! Skipping - ${bot.email}`);
                writeLog(`Wrong Password! Skipping - ${bot.email}`, "Error:");
                if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
                  fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
                }
                skippedBots(botdb.indexOf(bot));
                callback();
                return;
              } else if ($(`form[name="ATOPinChallengeForm"]`).length !== 0) {
                log_err(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`);
                writeLog(
                  `Pin requested for Bot #${botdb.indexOf(bot) + 1}!`,
                  "Error:"
                );
                var dts = $('input[name="dts"]').attr("value");
                var treeId = $('meta[name="treeID"]').attr("content");
                var chal_id = $('input[name="security-challenge-id"]').attr(
                  "value"
                );
                var alias = $('input[name="sourceAlias"]').attr("value");
                var pins = await mailconfirm();

                options["headers"] = {
                  authority: "www.linkedin.com",
                  method: "POST",
                  path: "/uas/ato-pin-challenge-submit",
                  scheme: "https",
                  accept:
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                  "accept-encoding": "gzip, deflate, br",
                  "accept-language":
                    "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
                  "cache-control": "max-age=0",
                  "content-type": "application/x-www-form-urlencoded",
                  origin: "https://www.linkedin.com",
                  referer: "https://www.linkedin.com/",
                  "upgrade-insecure-requests": 1,
                  "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36"
                };

                var new_cookies = resp.headers["set-cookie"];

                if (!new_cookies) {
                  log_err(
                    `3Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${
                    bot.email
                    }`
                  );
                  writeLog(
                    `3Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${
                    bot.email
                    }`
                  );
                  console.log(`CSRF: ${bot.csrf}`);
                  console.log(`Cookies: ${bot.cookies}`);
                  console.log(`Headers: ${resp.headers}`);
                  log_err("");
                  setTimeout(login, 4000);
                  return;
                }

                for (cookie of new_cookies) {
                  var name = cookie.match(/([^.]*?)=([^.]*?);/)[1];
                  var val = cookie.match(/([^.]*?)=([^.]*?);/)[2];

                  if (val.indexOf("delete") == -1) {
                    val = val.replace(/"/g, "");
                    options.cookies[`${name}`] = val;
                  }
                }

                var cnt = 0;
                pin_submit_2();

                function pin_submit_2() {
                  var obj = {
                    PinVerificationForm_pinParam: pins[cnt],
                    signin: "Submit",
                    "security-challenge-id": chal_id,
                    dts: dts,
                    origSourceAlias: "",
                    csrfToken: resp.cookies["JSESSIONID"],
                    sourceAlias: alias
                  };

                  needle.post(
                    `https://www.linkedin.com/uas/ato-pin-challenge-submit`,
                    obj,
                    options,
                    async function (err, resp) {
                      if (err == null && resp.statusCode === 200) {
                        var $ = cheerio.load(resp.body);

                        if (
                          $(`form[name="ATOPinChallengeForm"]`).length !== 0
                        ) {
                          console.log("Trying next pin");
                          writeLog(`Trying next pin`, "Note:");
                          cnt++;
                          if (cnt < pins.length) {
                            pin_submit_2();
                          } else {
                            console.log(
                              `No more pins! Skipping - ${bot.email}`
                            );
                            writeLog(
                              `No more pins! Skipping - ${bot.email}`,
                              "Note:"
                            );
                            if (
                              fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)
                            ) {
                              fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
                            }
                            skippedBots(botdb.indexOf(bot));
                            callback();
                          }
                        } else {
                          record_cookie(resp.headers);
                        }

                        fs.writeFileSync("t.html", resp.body, function () { });
                      } else {
                        console.log(err);
                        writeLog(err, "Error:");
                      }
                    }
                  );
                }
              } else {
                fs.writeFileSync("ttest.html", resp.body, function () { });
                //	await solveCaptcha()
                record_cookie(resp.headers);
              }

              function record_cookie(headers, cap, body) {
                function proceed(newOptionsCookies = true) {
                  log(
                    `Login for Bot #${botdb.indexOf(bot) + 1} complete! (${
                    bot.email
                    })`
                  );
                  writeLog(
                    `Login for Bot #${botdb.indexOf(bot) + 1} complete! (${
                    bot.email
                    })`,
                    "Info:"
                  );
                  login_done = true;
                  if (newOptionsCookies) {
                    options.cookies = bot.cookies;
                  }
                  options.follow_max = 5;
                  options.follow_set_cookies = true;
                  streamline();
                }
                if (!cap) {
                  if (
                    "location" in headers &&
                    isRedirectUrl(headers["location"])
                  ) {
                    bot.csrf = options.cookies.JSESSIONID;
                    proceed(false);
                    return;
                  }

                  var new_cookies = headers["set-cookie"];
                  bot.cookies = options["cookies"];

                  if (!new_cookies) {
                    log_err(
                      `1Some login error? On Bot #${botdb.indexOf(bot) +
                      1} and ${bot.email}`
                    );
                    writeLog(
                      `1Some login error? On Bot #${botdb.indexOf(bot) +
                      1} and ${bot.email}`
                    );
                    console.log(`CSRF: ${util.inspect(bot.csrf)}`);
                    console.log(`Cookies: ${util.inspect(bot.cookies)}`);
                    console.log(`Headers: ${util.inspect(headers)}`);
                    console.log(`Body: ${body}`);
                    setTimeout(login, 4000);
                    return;
                  }

                  // for(cookie of new_cookies){
                  // 	var name = cookie.match(/([^.]*?)=([^.]*?);/)[1]
                  // 	var val = cookie.match(/([^.]*?)=([^.]*?);/)[2]

                  // 	if(val.indexOf('delete') == -1){
                  // 		val = val.replace(/"/g,'')
                  // 		bot.cookies[`${name}`] = val
                  // 	}
                  // }

                  if (
                    (bot.csrf == "" || bot.csrf === undefined) &&
                    (bot.cookies !== "" || bot.cookies !== undefined)
                  ) {
                    var new_cookies = resp.headers["set-cookie"];
                    bot.cookies = options["cookies"];
                    //console.log(bot.cookies)

                    for (cookie of new_cookies) {
                      var name = cookie.match(/([^.]*?)=([^.]*?);/)[1];
                      var val = cookie.match(/([^.]*?)=([^.]*?);/)[2];

                      if (val.indexOf("delete") == -1) {
                        val = val.replace(/"/g, "");
                        bot.cookies[`${name}`] = val;
                      }
                    }

                    bot.csrf = resp.cookies.JSESSIONID;

                    if (bot.csrf && !login_done) {
                      //console.log(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`)
                      log(
                        `Login for Bot #${botdb.indexOf(bot) + 1} complete! (${
                        bot.email
                        })`
                      );
                      writeLog(
                        `Login for Bot #${botdb.indexOf(bot) + 1} complete! (${
                        bot.email
                        })`,
                        "Info:"
                      );
                      login_done = true;
                      options.cookies = bot.cookies;

                      streamline();
                    } else {
                      login();
                    }
                  } else {
                    log_err(
                      `2Some login error? On Bot #${botdb.indexOf(bot) +
                      1} and ${bot.email}`
                    );
                    writeLog(
                      `2Some login error? On Bot #${botdb.indexOf(bot) +
                      1} and ${bot.email}`
                    );
                    console.log(`CSRF: ${bot.csrf}`);
                    console.log(`Cookies: ${bot.cookies}`);
                    console.log(`Headers: ${resp.headers}`);
                    log_err("");
                    setTimeout(login, 4000);
                    return;
                  }
                } else {
                  for (cookie of headers) {
                    var name = cookie.name;
                    var val = cookie.value;
                    if (val.indexOf("delete") == -1) {
                      val = val.replace(/"/g, "");
                      bot.cookies[`${name}`] = val;
                    }
                  }

                  bot.csrf = bot.cookies["JSESSIONID"];

                  if (bot.csrf && !login_done) {
                    proceed();
                  } else {
                    callback(true);
                  }
                }
              }
            } else {
              console.log("login Error");
              log_err(err);
              writeLog(err, "Error:");
              login();
            }
          }
        );
      } else {
        console.log("login Error1");
        log_err(err);
        writeLog(err, "Error:");
        login();
      }
    });
  }

  function isRedirectUrl(location) {
    return location.includes("redir");
  }

  function mailconfirm(repeated) {
    console.log("mailconfirm");
    return new Promise(function (resolve, reject) {
      var getMails_tries = 0;
      function getMails() {
        getMails_tries++;

        if (getMails_tries >= 4) {
          log(
            `getMails failed on Bot #${botdb.indexOf(bot) + 1} ${bot.name}`,
            "Error"
          );
          fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, function () { });
          botsActive.splice(botsActive.indexOf(bot), 1);
          skippedBots(botdb.indexOf(bot));
          callback();
          return;
        }

        var options = {
          compressed: true,
          rejectUnauthorized: false,
          open_timeout: 10000,
          response_timeout: 10000,
          read_timeout: 10000,
          proxy: bot.proxy + ":" + bot.port
        };

        options["headers"] = {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
          Connection: "keep-alive",
          Host: "mail.ru",
          "Upgrade-Insecure-Requests": 1,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36"
        };

        needle.get(`https://mail.ru/`, options, function (err, resp) {
          if (err == null && resp.statusCode === 200) {
            options["cookies"] = resp.cookies;
            options["headers"] = {
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
              "Accept-Encoding": "gzip, deflate, br",
              "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
              "Cache-Control": "max-age=0",
              Connection: "keep-alive",
              "Content-Type": "application/x-www-form-urlencoded",
              Host: "auth.mail.ru",
              Origin: "https://mail.ru",
              Referer: "https://mail.ru/",
              "Upgrade-Insecure-Requests": 1,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36"
            };
            options.follow_max = 15;
            options.follow_set_cookies = true;

            var bot_auth = {
              Login: bot.email,
              Domain: "mail.ru",
              Password: bot.passMail,
              saveauth: 0,
              FromAccount: 0,
              token: resp.cookies["act"]
            };

            needle.post(
              `https://auth.mail.ru/cgi-bin/auth?from=splash`,
              bot_auth,
              options,
              function (err, resp) {
                if (err == null && resp.statusCode === 200) {
                  options["cookies"] = Object.assign(
                    options["cookies"],
                    resp.cookies
                  );

                  var token = resp.body.match(
                    /patron.updateToken\("([a-zA-Z0-9:]+)/
                  );
                  if (token !== null) {
                    token = token[1];
                  } else {
                    console.log(
                      `Token Error for Bot #${botdb.indexOf(bot) +
                      1}(mailru), repeating`
                    );
                    writeLog(
                      `Token Error for Bot #${botdb.indexOf(bot) +
                      1}(mailru), repeating`,
                      "Error:"
                    );
                    if (repeated) {
                      console.log(
                        `2nd Token Error for Bot #${botdb.indexOf(bot) +
                        1}(mailru), skipping`
                      );
                      writeLog(
                        `2nd Token Error for Bot #${botdb.indexOf(bot) +
                        1}(mailru), skipping`
                      );
                      if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
                        fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
                      }
                      skippedBots(botdb.indexOf(bot));
                      callback();
                      return;
                    } else {
                      mailconfirm(true);
                      return;
                    }
                  }

                  var date = new Date();
                  date = date.getTime();

                  var rnd = Math.random();

                  var obj = {
                    __urlp: `/threads/status/smart?ajax_call=1&x-email=${bot.email.replace(
                      "@",
                      "%40"
                    )}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date}&email=${bot.email.replace(
                      "@",
                      "%40"
                    )}&sort=%7B%22type%22%3A%22date%22%2C%22order%22%3A%22desc%22%7D&offset=0&limit=26&folder=0&htmlencoded=false&last_modified=-1&filters=%7B%7D&letters=true&nolog=1&sortby=D&rnd=${rnd}&api=1&token=${token.replace(
                      ":",
                      "%3A"
                    )}`
                  };

                  options["headers"] = {
                    Accept: "text/plain, */*; q=0.01",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Accept-Language":
                      "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
                    Connection: "keep-alive",
                    "Content-Type":
                      "application/x-www-form-urlencoded;charset=UTF-8",
                    Host: "e.mail.ru",
                    Origin: "https://e.mail.ru",
                    Referer: "https://e.mail.ru/",
                    "User-Agent":
                      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
                    "X-Requested-With": "XMLHttpRequest"
                  };

                  needle.post(
                    `https://e.mail.ru/api/v1`,
                    obj,
                    options,
                    function (err, resp) {
                      if (err == null && resp.statusCode === 200) {
                        var threads = resp.body.body.threads;

                        var ln_threads = threads.filter(function (cur) {
                          return (
                            cur.correspondents.from[0].email ==
                            "security-noreply@linkedin.com"
                          );
                        });

                        if (ln_threads.length !== 0) {
                          var pin = [];

                          var getM = tress(function (query, callback) {
                            needle.post(
                              `https://e.mail.ru/api/v1`,
                              query,
                              options,
                              function (err, resp) {
                                if (err == null && resp.statusCode === 200) {
                                  if (
                                    query["__urlp"].indexOf("threads") !== -1
                                  ) {
                                    var message = resp.body.body.messages[0].body.text.match(
                                      /Please use this verification code to complete your sign in: ([0-9]+)/
                                    );

                                    if (message !== null) {
                                      pin.push(message[1]);

                                      if (resp.body.body.messages.length > 1) {
                                        for (
                                          var i = 1;
                                          i < resp.body.body.messages.length;
                                          i++
                                        ) {
                                          var obj = {
                                            __urlp: `/messages/message?ajax_call=1&x-email=${bot.email.replace(
                                              "@",
                                              "%40"
                                            )}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date +
                                            20}&email=${bot.email.replace(
                                              "@",
                                              "%40"
                                            )}&htmlencoded=false&multi_msg_prev=0&multi_msg_past=0&sortby=D&NewAttachViewer=1&AvStatusBar=1&let_body_type=let_body_plain&log=0&bulk_show_images=0&folder=0&wrap_body=0&id=${
                                              resp.body.body.messages[i].id
                                              }&read=${
                                              resp.body.body.messages[i].id
                                              }&NoMSG=true&mark_read=true&api=1&token=${token.replace(
                                                ":",
                                                "%3A"
                                              )}`
                                          };
                                          getM.push(obj);
                                        }
                                      }

                                      callback();
                                    } else {
                                      callback();
                                      return;
                                    }
                                  } else {
                                    var message = resp.body.body.body.text.match(
                                      /Please use this verification code to complete your sign in: ([0-9]+)/
                                    );

                                    if (message !== null) {
                                      pin.push(message[1]);

                                      callback();
                                    } else {
                                      callback();
                                      return;
                                    }
                                  }
                                } else {
                                  console.log(`Error: couldn't open message`);
                                  writeLog(
                                    `Error: couldn't open message`,
                                    "Error:"
                                  );
                                  callback(true);
                                }
                              }
                            );
                          }, 5);

                          getM.drain = function () {
                            if (pin.length !== 0) {
                              resolve(pin);
                            } else {
                              log_err(
                                `Wrong Message(no pins messages) on Bot #${botdb.indexOf(
                                  bot
                                ) + 1}!`
                              );
                              writeLog(
                                `Wrong Message(no pins messages) on Bot #${botdb.indexOf(
                                  bot
                                ) + 1}!`,
                                "Error:"
                              );
                              callback();
                              return;
                            }
                          };

                          getM.retry = function () {
                            getM.pause();

                            setTimeout(function () {
                              getM.resume();
                            }, 1000);
                          };

                          for (thread of ln_threads) {
                            var obj = {
                              __urlp: `/threads/thread?ajax_call=1&x-email=${bot.email.replace(
                                "@",
                                "%40"
                              )}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date +
                              20}&email=${bot.email.replace(
                                "@",
                                "%40"
                              )}&offset=0&limit=50&htmlencoded=false&id=${thread.id.replace(
                                /:/g,
                                "%3A"
                              )}&api=1&token=${token.replace(":", "%3A")}`
                            };
                            getM.push(obj);
                          }
                        } else {
                          console.log("No messages yet");
                          writeLog("No messages yet", "Note:");
                          setTimeout(getMails, 10000);
                        }
                      } else {
                        console.log(err);
                        writeLog(err, "Error:");
                        setTimeout(getMails, 10000);
                      }
                    }
                  );
                } else {
                  console.log(err);
                  writeLog(err, "Error:");
                  setTimeout(getMails, 10000);
                }
              }
            );
          } else {
            console.log(err);
            writeLog(err, "Error:");
            setTimeout(getMails, 10000);
          }
        });
      }

      setTimeout(getMails, 5000);
    });
  }

  async function solveCaptcha() {
    return new Promise(async function (resolve, reject) {
      var options = new chrome.Options();
      options.addArguments("window-size=1680,1050");
      options.addArguments("disable-web-security");
      options.addArguments("allow-running-insecure-content");
      options.addArguments("headless");
      options.addArguments("--disable-gpu");
      options.addArguments("--log-level=3");
      options.addArguments(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36"
      );

      var capabilities = webdriver.Capabilities.chrome();
      capabilities.setPageLoadStrategy("none");

      var driver = new webdriver.Builder()
        .forBrowser("chrome")
        .withCapabilities(capabilities)
        .setProxy(
          proxy.manual({
            http: `${bot.proxy}:${bot.port}`,
            https: `${bot.proxy}:${bot.port}`
          })
        )
        .setChromeOptions(options)
        .build();

      await driver.get("https://www.linkedin.com");
      await domCheck("complete");

      try {
        await driver.wait(until.elementLocated(By.id("login-email")), 25000);
        await driver.findElement({ id: "login-email" }).sendKeys(bot.email);
        await driver.findElement({ id: "login-password" }).sendKeys(bot.pass);
        await driver.sleep(1500);
        await driver.findElement({ id: "login-submit" }).click();
      } catch (e) {
        await driver.get(
          "https://www.linkedin.com/uas/login?trk=guest_homepage-basic_nav-header-signin"
        );
        await domCheck("complete");
        await driver.wait(until.elementLocated(By.id("username")), 25000);
        await driver.findElement({ id: "username" }).sendKeys(bot.email);
        await driver.findElement({ id: "password" }).sendKeys(bot.pass);
        await driver.sleep(1500);
        await driver
          .findElement({
            className: "btn__primary--large from__button--floating"
          })
          .click();
      }

      await domCheck("complete");

      var type_1 = await driver.findElements({ id: "challengeContent" });
      var type_2 = await driver.findElements({ id: "captcha-challenge" });
      var attempts = 0;

      if (type_1.length == 0 && type_2.length == 0) {
        var ckies = await driver.manage().getCookies();
        await driver.quit();
        resolve(ckies);
        return;
      } else {
        //	await driver.sleep(100000000)
        var gkey = "";
        var url = "";

        await driver.getCurrentUrl().then(function (lnk) {
          url = lnk;

          getGkey();
        });

        function getGkey() {
          driver.sleep(3000).then(function () {
            driver
              .findElements({ css: 'input[type="hidden"]' })
              .then(function (els) {
                els.forEach(function (el) {
                  el.getAttribute("value")
                    .then(function (val) {
                      if (val.length == 40) {
                        gkey = val;
                      }
                    })
                    .catch(function () {
                      //
                    });
                });
              })
              .then(function () {
                if (gkey == "") {
                  getGkey();
                } else {
                  main();
                }
              });
          });
        }

        function main() {
          var key = "1a21be9ca8506169bd5b2a310457a8d0";
          var code = "";
          var tries = 0;

          var requestOptions = {
            url: `http://2captcha.com/in.php?key=${key}&method=userrecaptcha&googlekey=${gkey}&pageurl=${url}`,
            method: "GET"
          };

          request(requestOptions, function (err, resp, body) {
            if (err == null && resp.statusCode === 200) {
              code = body.substring(3, body.length);
              console.log(`Got response from 2captcha - ${body}`);
              writeLog(`Got response from 2captcha - ${body}`, "Info:");
            }
          });

          var ans = "";

          var chk = setInterval(function () {
            var requestOptions = {
              url: `http://2captcha.com/res.php?key=${key}&action=get&id=${code}`,
              method: "GET"
            };

            request(requestOptions, function (err, resp, body) {
              if (err == null && resp.statusCode === 200) {
                tries++;
                if (body.length > 40) {
                  console.log("Got captcha answer from 2captcha");
                  writeLog("Got captcha answer from 2captcha", "Info:");
                  ans = body.substring(3, body.length);
                  clearInterval(chk);
                  goNext(ans).then(
                    function () { },
                    function () {
                      resolve(false);
                    }
                  );
                } else {
                  console.log(body);
                  if (tries == 10) {
                    console.log(
                      "Captcha solving timed out. Sending another request..."
                    );
                    writeLog(
                      "Captcha solving timed out. Sending another request...",
                      "Info:"
                    );
                    clearInterval(chk);
                    main();
                  }
                }
              }
            });
          }, 10000);
        }

        async function goNext(ans) {
          var type_3 = await driver.findElements({ id: "challengeContent" });
          var type_4 = await driver.findElements({ id: "captcha-challenge" });
          await driver.switchTo().frame(0);
          await driver.wait(
            until.elementLocated(By.name("g-recaptcha-response")),
            30000
          );
          var el = await driver.findElement({ name: "g-recaptcha-response" });
          await driver.executeScript(
            "arguments[0].setAttribute('style', 'display:block')",
            el
          );
          await el.sendKeys(ans);
          var handles = await driver.getAllWindowHandles();
          await driver.switchTo().window(handles[handles.length - 1]);
          await driver.sleep(3000);
          if (type_1.length > 0) {
            await driver.executeScript(
              `window.espanyContainer.contentWindow.grecaptchaData.callback()`
            );
          } else if (type_2.length > 0) {
            var el = await driver.findElement({
              css: 'input[name="captchaUserResponseToken"]'
            });
            await driver.executeScript(
              `arguments[0].setAttribute('value','${ans}')`,
              el
            );
            await driver.findElement({ id: "captcha-challenge" }).submit();
          }
          await driver.sleep(15000);
          type_3 = await driver.findElements({ id: "challengeContent" });
          type_4 = await driver.findElements({ id: "captcha-challenge" });

          if (type_3.length !== 0 || type_4.length !== 0) {
            log("Failed captcha, retrying");
            writeLog("Failed captcha, retrying", "Error:");
            if (attempts < 5) {
              attempts++;
              main();
            } else {
              log_err(
                `Too many attempts to solve captcha for ${bot.email}, skipping`
              );
              writeLog(
                `Too many attempts to solve captcha for ${bot.email}, skipping`,
                "Error:"
              );
              if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
                fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
              }
              skippedBots(botdb.indexOf(bot));
              await driver.quit();
              callback();
            }
          } else {
            log("Passed captcha!");
            writeLog("Passed captcha!", "Info:");
            var els = await driver.findElements({ id: "error-for-password" });
            var els2 = await driver.findElements({
              id: "session_password-login-error"
            });
            var els3 = await driver.findElements({ id: "idverifyUrl" });
            var els4 = await driver.findElements({
              css: 'form[name="ATOPinChallengeForm"]'
            });
            var els5 = await driver.findElements({
              id: "pagekey-uas-account-restricted"
            });
            var els6 = await driver.findElements({ id: "email-pin-error" });
            if (els.length > 0 || els2.length > 0) {
              log_err(`Wrong Password! Skipping - ${bot.email}`);
              writeLog(`Wrong Password! Skipping - ${bot.email}`, "Error:");
              if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
                fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
              }
              skippedBots(botdb.indexOf(bot));
              await driver.quit();
              resolve(false);
            } else {
              if (els3.length > 0 || els5.length > 0) {
                log_err(
                  `Account is banned! Skipping - ${
                  bot.email
                  } Bot #${botdb.indexOf(bot) + 1}`
                );
                writeLog(
                  `Account is banned! Skipping - ${
                  bot.email
                  } Bot #${botdb.indexOf(bot) + 1}`,
                  "Error:"
                );
                if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
                  fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`);
                }
                skippedBots(botdb.indexOf(bot));
                await driver.quit();
                resolve(false);
              } else {
                if (els4.length > 0 || els6.length > 0) {
                  log_err(
                    `Pin required for account - ${
                    bot.email
                    } - will try to log normally`
                  );
                  writeLog(
                    `Pin required for account - ${
                    bot.email
                    } - will try to log normally`,
                    "Error:"
                  );
                  await driver.quit();
                  callback();
                  return;
                } else {
                  var ckies = await driver.manage().getCookies();
                  await driver.quit();
                  resolve(ckies);
                }
              }
            }
          }
        }
      }

      function domCheck(type) {
        return new Promise(function (resolve, reject) {
          var rscheck = setInterval(function () {
            driver
              .executeScript("return document.readyState")
              .then(function (rs) {
                //	console.log(rs)
                if (type == undefined) {
                  if (rs == "interactive" || rs == "complete") {
                    clearInterval(rscheck);
                    resolve(rs);
                  }
                } else {
                  if (type == "complete") {
                    if (rs == "complete") {
                      clearInterval(rscheck);
                      resolve(rs);
                    }
                  }
                }
              });
          }, 1000);
        });
      }
    });
  }

  function streamline() {
    if (functions.length >= fstart + 1) {
      switch (functions[fstart]) {
        case "geturl":
          //console.log(fstart)
          fstart++;
          setTimeout(function () {
            geturl(true, null);
          }, between_functions);
          break;
        case "privacy":
          //console.log(fstart)
          fstart++;
          setTimeout(function () {
            privacy();
          }, between_functions);
          break;
        case "details":
          fstart++;
          setTimeout(function () {
            details();
          }, between_functions);
          break;
        case "avatar":
          fstart++;
          setTimeout(function () {
            avatar();
          }, between_functions);
          break;
        case "experience":
          console.log(fstart);
          fstart++;
          setTimeout(function () {
            experience();
          }, between_functions);
          break;
        case "education":
          fstart++;
          setTimeout(function () {
            education();
          }, between_functions);
          break;
        case "skillset":
          fstart++;
          setTimeout(function () {
            skillset();
          }, between_functions);
          break;
        case "changepw":
          fstart++;
          setTimeout(function () {
            changepw();
          }, between_functions);
          break;
        case "invitesettings":
          fstart++;
          setTimeout(function () {
            invitesettings();
          }, between_functions);
          break;
        case "acceptinvites":
          fstart++;
          setTimeout(function () {
            acceptinvites();
          }, between_functions);
          break;
        /* case 'headline':
						fstart++
						setTimeout(function(){headline()},between_functions)
						break */
      }
    } else {
      log(`All functions are done for ${bot.email}!`);
      writeLog(`All functions are done for ${bot.email}!`, "Info:");
      if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
        fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, function (err, res) {
          console.log("error", err);
        });
      }
      callback();
      return;
    }
  }

  function geturl(sl, func) {
    //console.log('geturl')
    options["headers"] = {
      authority: "www.linkedin.com",
      method: "GET",
      path: "/feed/?trk=",
      scheme: "https",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
      "cache-control": "max-age=0",
      referer: "https://www.linkedin.com/",
      "upgrade-insecure-requests": 1,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36"
      //'cookie': 'bcookie="v=2&8f13d318-b075-43f1-8e97-2c21a08634d5"; bscookie="v=1&20190425170302c52d26b2-99e6-44a1-8d0b-43f96cf91ae7AQFxmNWybZ_9SIiWe8Ocp1KJyulQoOe-"; _ga=GA1.2.1379442034.1556211788; aam_uuid=66850492915209532473998933754781389196; _guid=41ac5586-2681-4676-8cf8-4a5374e3bddf; li_oatml=AQHGVUBo73_XKQAAAWpVrCCNbynNOOfm6ewLq5SfCswaEpS5GMewJ54IQTLKIR3fdMGG6cccypJcWBRLkBxGJ0KaYf5Bz8En; visit=v=1&M; _lipt=CwEAAAFqaOaaQbOiB9kul0TjpeBG0J9IP_pY2AFPYmg-r8VfLNi133IRacdpsHxDoU5bBSRzXLDhKvVj90_-OoMFd3u39dTj4JLDa22qR_Znnt0JpZlyVhVRQSiJ-Ms9_ACGgdJyCcG65wEWolKE35ltXT9UpvxGjsJ6NUnHPOZEdIzj8SCAT6iNQILQwB33mgsg0wsrjCl7Ed-BWLgbgzEf8z-pAy1XN-3cv5KACFqC85Bk1C--owNV8rutyMjP0sMM0bc8X32y3lrlRAu1a_WS2SeT7k3ccg; AMCVS_14215E3D5995C57C0A495C55%40AdobeOrg=1; JSESSIONID="ajax:4265582793435635918"; fid=AQH0QbUNhydzQQAAAWpqOcS8Wu4eJCFL2Rpbr6UbVPv5-SGieaPihll01Y2T8Xd8gIBjB1R6Wkv_Ng; fcookie=AQGUeBkpio3i2wAAAWpqOdEdF6DZ_4xRZAebKwX-25WXui4TYNdOi0tY3mKjADSdQ4xip9CaTpFWkNCa_BcjdYfpNBSqsemf1IKJHOGrJmVah8hN65T-j6RCIMQNp-hsLzDpuBqq3t_Qs7-IKHlA6l7IBudw9bShGgWx25udlMdqw3vaeZbKApfRmhMPBzCGw75XU2RV3kp-jUkHg66V03RPn2pR-ijfF0FySvZwqvJIMtl9iTZhbvlrqgcfOR3vftW6dGgytVhBIFauhsL6nASBWvgTcUNbJX/J1Xy2NP0z2rMZIUPladRhxeWD6J9UxvXuFyg11J4bFGwBCPmaKqiMJFBXlwCqxm7u5A==; sl=v=1&DwXNZ; liap=true; li_at=AQEDASpONvUEae4LAAABampVB3wAAAFqjmGLfE0AqDUdlZZVsU25zAZHL70305Q_7Mh-_qzukT_YOqsMNMG3bjNVN26Hkz4rlnKZ_k2WMHHbZjpfDfKvP2TQmcxFy6ngTKkgzJJR_YvyqoMLfEpIwzcM; lang=v=2&lang=en-us; _gat=1; lidc="b=VB49:g=2188:u=7:i=1556596637:t=1556660689:s=AQEP3nu70Wk2UsdvI-JutNTcVt8maBPn"; UserMatchHistory=AQJ75COAvsO0tQAAAWpsY8ZmTZgS1rexyT9fUO2gX1-fTAVccoHaXacecQhl5BnwUlaPJRgJc6dvH-Hq58568glvW2YgVjyZIG8wwGiQ6s2k6bszkIS7SwtJVQf2ClCjF5yrbOvx8m4cWw7EVKlmt_gyBYGXsSDTq8j0JRvbV0wJAKFxibQ45Fd9GirX5LHU3X3XiJkXuw; AMCV_14215E3D5995C57C0A495C55%40AdobeOrg=-1303530583%7CMCIDTS%7C18016%7CMCMID%7C66319021140297462604012775629687792199%7CMCAAMLH-1557201440%7C7%7CMCAAMB-1557201440%7CRKhpRz8krg2tLO6pguXWp5olkAcUniQYPHaMWWgdJ3xzPWQmdj0y%7CMCOPTOUT-1556603840s%7CNONE%7CvVersion%7C3.3.0%7CMCCIDH%7C-1613305357'
    };

    needle.get("https://www.linkedin.com/feed/?trk=", options, function (
      err,
      resp
    ) {
      if (err == null && resp.statusCode === 200) {
        resp.body = resp.body.replace(/&quot;/g, "");
        var lnk = resp.body.match(/publicIdentifier:([a-zA-Z0-9-_]*)/);

        if (lnk !== null) {
          lnk = `https://www.linkedin.com/in/${lnk[1]}`;
        } else {
          log_err(
            `Probably wrong page, error getting url address for ${
            bot.email
            }, repeating`
          );
          log_err(
            `Error on login: captcha or wrong password, skipping the ${
            bot.email
            }`
          );
          if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
            fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, function () { });
          }
          skippedBots(botdb.indexOf(bot));
          callback();
          return;
        }

        if (sl) {
          log(
            `Now the profile link for Bot #${botdb.indexOf(bot) +
            1} is - ${lnk}`
          );
          writeLog(
            `Now the profile link for Bot #${botdb.indexOf(bot) +
            1} is - ${lnk}`,
            "Info:"
          );
          streamline();
        } else {
          tag = lnk;
          switch (func) {
            case "details":
              details();
              break;
            case "avatar":
              avatar();
              break;
            case "experience":
              experience();
              break;
            case "education":
              education();
              break;
            case "skillset":
              skillset();
              break;
            case "headline":
              headline();
              break;
          }
        }
      } else {
        log_err(err);
        geturl(sl, func);
        return;
      }
    });
  }

  function privacy() {
    var options_2 = Object.assign({}, options);
    var eventEmitter = new events.EventEmitter();
    var done = 0;

    options_2["headers"] = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
      Connection: "keep-alive",
      "Content-Type": "multipart/form-data;",
      Host: "www.linkedin.com",
      Origin: "https://www.linkedin.com",
      Referer: "https://www.linkedin.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      "X-Requested-With": "XMLHttpRequest"
    };

    options_2.multipart = true;

    var data_1 = {
      dataKey: "videoAutoPlayed",
      el: "#setting-videos",
      settingsUrls: "[object Object]",
      name: "videos",
      locale: "en_US",
      isNotCnDomain: true,
      headerData: "[object Object]",
      path: "/psettings/videos",
      cancelUrl:
        "https://www.linkedin.com/settings/?tab=account&trk=psettings-videos-cancel",
      redirectUrl:
        "https://www.linkedin.com/settings/?tab=account&trk=psettings-videos-redirect",
      lixTests: "[object Object]",
      pageTitle: "Video settings",
      settingVisibility: "[object Object]",
      autoPlayVideos: false,
      device: "DESKTOP",
      setting: "videos",
      initialFetch: true,
      dataVal: true,
      hasSuccess: false,
      errors: "[object Object]",
      data: false,
      csrfToken: bot.csrf
    };

    var data_2 = {
      dataKey: "connectionVisibility",
      el: "#setting-connections-visibility",
      settingsUrls: "[object Object]",
      name: "connections-visibility",
      locale: "en_US",
      isNotCnDomain: true,
      headerData: "[object Object]",
      path: "/psettings/connections-visibility",
      data: false,
      lixTests: "[object Object]",
      pageTitle: "Connections visibility",
      settingVisibility: "[object Object]",
      device: "DESKTOP",
      setting: "connections-visibility",
      initialFetch: true,
      dataVal: true,
      hasSuccess: true,
      errors: "[object Object]",
      isAllowConnectionsBrowse: false,
      csrfToken: bot.csrf
    };

    var data_3 = {
      dataKey: "broadcastsActivity",
      el: "#setting-activity-broadcast",
      settingsUrls: "[object Object]",
      name: "activity-broadcast",
      locale: "en_US",
      isNotCnDomain: true,
      headerData: "[object Object]",
      path: "/psettings/activity-broadcast",
      data: false,
      lixTests: "[object Object]",
      pageTitle: "Sharing profile edits",
      settingVisibility: "[object Object]",
      device: "DESKTOP",
      setting: "activity-broadcast",
      initialFetch: true,
      dataVal: true,
      hasSuccess: false,
      errors: "[object Object]",
      isAutoNetworkUpdatesPrefs: false,
      csrfToken: bot.csrf
    };

    var data_4 = {
      dataKey: "browseMap",
      el: "#setting-browse-map",
      settingsUrls: "[object Object]",
      name: "browse-map",
      locale: "en_US",
      isNotCnDomain: true,
      headerData: "[object Object]",
      path: "/psettings/browse-map",
      data: false,
      lixTests: "[object Object]",
      pageTitle: "Viewers of this profile also viewed...",
      settingVisibility: "[object Object]",
      device: "DESKTOP",
      setting: "browse-map",
      initialFetch: true,
      dataVal: true,
      hasSuccess: false,
      errors: "[object Object]",
      showBrowseMap: false,
      csrfToken: bot.csrf
    };

    var data_5 = {
      dataKey: "allowShownInMeetTheTeam",
      el: "#setting-meet-the-team",
      settingsUrls: "[object Object]",
      name: "meet-the-team",
      locale: "en_US",
      isNotCnDomain: true,
      headerData: "[object Object]",
      path: "/psettings/meet-the-team",
      data: false,
      lixTests: "[object Object]",
      pageTitle: "Meet the team",
      settingVisibility: "[object Object]",
      settingsUrl: "https://www.linkedin.com/settings/",
      device: "DESKTOP",
      setting: "meet-the-team",
      initialFetch: true,
      dataVal: true,
      hasSuccess: false,
      errors: "[object Object]",
      isAllowShownInMeetTheTeam: false,
      csrfToken: bot.csrf
    };

    var data_6 = {
      dataKey: "emailPrivacy",
      el: "#setting-privacy-email",
      settingsUrls: "[object Object]",
      name: "privacy/email",
      dataVal: "FIRST_DEGREE_CONNECTIONS",
      locale: "en_US",
      headerData: "[object Object]",
      primaryHandle: "[object Object]",
      lixTests: "[object Object]",
      pageTitle: "Who can see your email address",
      settingVisibility: "[object Object]",
      settingsUrl: "https://www.linkedin.com/settings/",
      allowEmailExport: false,
      setting: "privacy/email",
      isNotCnDomain: true,
      privacySetting: "JUST_ME",
      path: "/psettings/privacy/email",
      handleType: "EMAIL",
      privacyOptions:
        "JUST_ME,FIRST_DEGREE_CONNECTIONS,SECOND_DEGREE_CONNECTIONS,EVERYONE,$UNKNOWN",
      device: "DESKTOP",
      initialFetch: true,
      hasSuccess: false,
      errors: "[object Object]",
      privacySettings: "JUST_ME",
      csrfToken: bot.csrf
    };

    eventEmitter.on("done", post_finish);

    vids();
    visibility();
    broadcast();
    browse_map();
    meet_team();
    emails();

    function vids() {
      needle.post(
        "https://www.linkedin.com/psettings/videos",
        data_1,
        options_2,
        function (err, resp) {
          if (err == null && resp.statusCode === 200) {
            done++;
            eventEmitter.emit("done");
          } else {
            //	log_err(err)
            vids();
          }
        }
      );
    }

    function visibility() {
      needle.post(
        "https://www.linkedin.com/psettings/connections-visibility",
        data_2,
        options_2,
        function (err, resp) {
          if (err == null && resp.statusCode === 200) {
            done++;
            eventEmitter.emit("done");
          } else {
            //	log_err(err)
            visibility();
          }
        }
      );
    }

    function broadcast() {
      needle.post(
        "https://www.linkedin.com/psettings/activity-broadcast",
        data_3,
        options_2,
        function (err, resp) {
          if (err == null && resp.statusCode === 200) {
            done++;
            eventEmitter.emit("done");
          } else {
            //	log_err(err)
            broadcast();
          }
        }
      );
    }

    function browse_map() {
      needle.post(
        "https://www.linkedin.com/psettings/browse-map",
        data_4,
        options_2,
        function (err, resp) {
          if (err == null && resp.statusCode === 200) {
            done++;
            eventEmitter.emit("done");
          } else {
            //	log_err(err)
            browse_map();
          }
        }
      );
    }

    function meet_team() {
      needle.post(
        "https://www.linkedin.com/psettings/meet-the-team",
        data_5,
        options_2,
        function (err, resp) {
          if (err == null && resp.statusCode === 200) {
            done++;
            eventEmitter.emit("done");
          } else {
            //	log_err(err)
            meet_team();
          }
        }
      );
    }

    function emails() {
      needle.post(
        "https://www.linkedin.com/psettings/privacy/email",
        data_6,
        options_2,
        function (err, resp) {
          if (err == null && resp.statusCode === 200) {
            done++;
            eventEmitter.emit("done");
          } else {
            //	log_err(err)
            emails();
          }
        }
      );
    }

    function post_finish() {
      if (done >= 6) {
        log(`Privacy settings done for Bot #${botdb.indexOf(bot) + 1}`);
        writeLog(
          `Privacy settings done for Bot #${botdb.indexOf(bot) + 1}`,
          "Info:"
        );
        streamline();
      }
    }
  }

  function details() {
    if (tag == "") {
      geturl(false, "details");
      return;
    }

    //console.log('tag', tag)
    var options_2 = Object.assign({}, options);

    options_2["headers"] = {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
      "Content-Type": "application/json; charset=UTF-8",
      "Csrf-Token": bot.csrf,
      Host: "www.linkedin.com",
      Origin: "https://www.linkedin.com",
      Referer: `${tag.replace(
        "https://www.linkedin.com/in/",
        ""
      )}/edit/topcard/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      "X-LI-Lang": "en_US",
      "X-LI-Track":
        '{"clientVersion":"1.2.2370","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
      "X-Requested-With": "XMLHttpRequest",
      "X-RestLi-Protocol-Version": "2.0.0"
    };

    var rng = Math.floor(Math.random() * 147 + 1);

    var data = {
      patch: {
        $set: {
          firstName: bot.firstname,
          lastName: bot.lastname,
          industryUrn: `urn:li:fs_industry:${rng}`
        },
        location: {
          basicLocation: {
            $set: {
              countryCode: "us",
              postalCode: bot.zip
            }
          }
        }
      }
    };

    needle.get(`${tag}/edit/topcard/`, options_2, function (err, resp) {
      if (err == null && resp.statusCode === 200) {
        try {
          var id = resp.body.match(
            /urn:li:fs_miniProfile:([a-zA-Z0-9_-]*)&quot;,/
          )[1];
          var ver = resp.body.match(/versionTag&quot;:&quot;([0-9]+)/)[1];
          var inst = resp.body.match(
            /(urn:li:page:d_flagship3_profile_self_edit_top_card[a-zA-Z0-9_;\/]*)/
          )[1];
        } catch (err) {
          fs.writeFileSync("dettest.html", resp.body, function () { });
          log_err(`In function Details for Bot #${botdb.indexOf(bot) + 1}`);
          writeLog(
            `In function Details for Bot #${botdb.indexOf(bot) + 1}`,
            "Error:"
          );
          details();
          return;
        }

        options_2["headers"] = {
          Accept: "*/*",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
          Connection: "keep-alive",
          "Content-Type": "application/json; charset=UTF-8",
          "Csrf-Token": bot.csrf,
          Host: "www.linkedin.com",
          Origin: "https://www.linkedin.com",
          Referer: `${tag.replace(
            "https://www.linkedin.com/in/",
            ""
          )}/edit/topcard/`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
          "X-LI-Lang": "en_US",
          "X-li-page-instance": inst,
          "X-LI-Track":
            '{"clientVersion":"1.2.2430","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
          "X-Requested-With": "XMLHttpRequest",
          "X-RestLi-Protocol-Version": "2.0.0"
        };

        var url = `https://www.linkedin.com/voyager/api/identity/normProfiles/${id}?versionTag=${ver}`;

        needle.post(url, JSON.stringify(data), options_2, function (err, resp) {
          if (
            err == null &&
            (resp.statusCode === 200 || resp.statusCode === 202)
          ) {
            log(
              `Now the name for Bot #${botdb.indexOf(bot) + 1} is - ${
              bot.firstname
              } ${bot.lastname}`
            );
            writeLog(
              `Now the name for Bot #${botdb.indexOf(bot) + 1} is - ${
              bot.firstname
              } ${bot.lastname}`,
              "Info:"
            );
            log(`Now the location for Bot #${botdb.indexOf(bot) + 1} is - US`);
            writeLog(
              `Now the location for Bot #${botdb.indexOf(bot) + 1} is - US`,
              "Info:"
            );
            tag = "";
            streamline();
          } else {
            //log_err(err)
            details();
          }
        });
      } else {
        //log_err(err)
        details();
      }
    });
  }

  async function avatar() {
    if (tag == "") {
      geturl(false, "avatar");
      return;
    }

    if (bot.img.indexOf("avatars/") == -1) {
      bot.img = "avatars/" + bot.img;
    }

    function getFilesizeInBytes(filename) {
      var stats = fs.statSync(filename);
      var fileSizeInBytes = stats["size"];
      return fileSizeInBytes;
    }

    var img_size = getFilesizeInBytes(`${bot.img}.jpg`);

    var options_2 = Object.assign({}, options);

    options_2["headers"] = {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
      "Content-Type": "application/json; charset=UTF-8",
      "Csrf-Token": bot.csrf,
      Host: "www.linkedin.com",
      Origin: "https://www.linkedin.com",
      Referer: `${tag}/edit/topcard/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      "X-LI-Lang": "en_US",
      "X-LI-Track":
        '{"clientVersion":"1.2.2370","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
      "X-Requested-With": "XMLHttpRequest",
      "X-RestLi-Protocol-Version": "2.0.0"
    };

    needle.get(`${tag}/edit/topcard/`, options_2, function (err, resp) {
      if (err == null && resp.statusCode === 200) {
        var id = resp.body.match(
          /urn:li:fs_miniProfile:([a-zA-Z0-9_-]*)&quot;,/
        )[1];
        var ver = resp.body.match(/versionTag&quot;:&quot;([0-9]+)/)[1];
        try {
          var inst =
            resp.body.match(
              /(urn:li:page:d_flagship3_profile_self_edit_top_card[a-zA-Z0-9_;+\/]*)/
            )[1] + "==";
        } catch (err) {
          log_err(
            `In function Avatar for Bot #${botdb.indexOf(bot) + 1}, repeating`
          );
          writeLog(
            `In function Avatar for Bot #${botdb.indexOf(bot) + 1}, repeating`,
            "Error:"
          );
          avatar();
          return;
        }

        options_2["headers"] = {
          Accept: "*/*",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
          "Content-Type": "application/json; charset=UTF-8",
          "Csrf-Token": bot.csrf,
          Host: "www.linkedin.com",
          Origin: "https://www.linkedin.com",
          Referer: `${tag}/edit/topcard/`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
          "X-LI-Lang": "en_US",
          "x-li-page-instance": inst,
          "X-LI-Track":
            '{"clientVersion":"1.2.2370","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
          "X-Requested-With": "XMLHttpRequest",
          "X-RestLi-Protocol-Version": "2.0.0"
        };

        var data_1 = {
          mediaUploadType: "PROFILE_ORIGINAL_PHOTO",
          fileSize: img_size,
          filename: `${bot.img}.jpg`
        };
        var data_2 = {
          mediaUploadType: "PROFILE_DISPLAY_PHOTO",
          fileSize: img_size
        };

        needle.post(
          `https://www.linkedin.com/voyager/api/voyagerMediaUploadMetadata?action=upload`,
          JSON.stringify(data_1),
          options_2,
          function (err, resp) {
            if (err == null && resp.statusCode === 200) {
              var url_1 = resp.body.value.singleUploadUrl;
              var urn_1 = resp.body.value.urn;
              needle.post(
                `https://www.linkedin.com/voyager/api/voyagerMediaUploadMetadata?action=upload`,
                JSON.stringify(data_2),
                options_2,
                function (err, resp) {
                  if (err == null && resp.statusCode === 200) {
                    var url_2 = resp.body.value.singleUploadUrl;
                    var urn_2 = resp.body.value.urn;

                    options_2["headers"] = {
                      authority: "www.linkedin.com",
                      method: "PUT",
                      path: url_1.replace("https://www.linkedin.com", ""),
                      scheme: "https",
                      accept: "*/*",
                      "accept-encoding": "gzip, deflate, br",
                      "accept-language":
                        "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
                      "content-length": img_size,
                      "content-type": "image/jpeg",
                      "csrf-token": bot.csrf,
                      origin: "https://www.linkedin.com",
                      referer: `${tag}/edit/topcard/`,
                      "user-agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36"
                    };

                    needle.put(
                      url_1,
                      fs.createReadStream(`${bot.img}.jpg`),
                      options_2,
                      function (err, resp) {
                        if (err == null && resp.statusCode === 201) {
                          options_2.headers["path"] = url_2.replace(
                            "https://www.linkedin.com",
                            ""
                          );

                          needle.put(
                            url_2,
                            fs.createReadStream(`${bot.img}.jpg`),
                            options_2,
                            function (err, resp) {
                              if (err == null && resp.statusCode === 201) {
                                options_2["headers"] = {
                                  Accept: "*/*",
                                  "Accept-Encoding": "gzip, deflate, br",
                                  "Accept-Language":
                                    "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
                                  Connection: "keep-alive",
                                  "Content-Type":
                                    "application/json; charset=UTF-8",
                                  "Csrf-Token": bot.csrf,
                                  Host: "www.linkedin.com",
                                  Origin: "https://www.linkedin.com",
                                  Referer: `${tag.replace(
                                    "https://www.linkedin.com/in/",
                                    ""
                                  )}/edit/topcard/`,
                                  "User-Agent":
                                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
                                  "X-LI-Lang": "en_US",
                                  "X-li-page-instance": inst,
                                  "X-LI-Track":
                                    '{"clientVersion":"1.2.2430","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
                                  "X-Requested-With": "XMLHttpRequest",
                                  "X-RestLi-Protocol-Version": "2.0.0"
                                };

                                var data_4 = {
                                  patch: {
                                    $set: {
                                      profilePicture: {
                                        originalImage: urn_1,
                                        displayImage: urn_2,
                                        photoFilterEditInfo: {
                                          brightness: 0,
                                          contrast: 0,
                                          saturation: 0,
                                          vignette: 0,
                                          photoFilterType: "ORIGINAL",
                                          topLeft: {
                                            x: -6.153917954930954e-17,
                                            y: 0.02300000000000001
                                          },
                                          topRight: {
                                            x: 0.9959999999999999,
                                            y: 0.02300000000000001
                                          },
                                          bottomLeft: {
                                            x: -6.153917954930954e-17,
                                            y: 0.865255033557047
                                          },
                                          bottomRight: {
                                            x: 0.9959999999999999,
                                            y: 0.865255033557047
                                          }
                                        }
                                      }
                                    }
                                  }
                                };

                                var url = `https://www.linkedin.com/voyager/api/identity/normProfiles/${id}?versionTag=${ver}`;

                                needle.post(
                                  url,
                                  JSON.stringify(data_4),
                                  options_2,
                                  function (err, resp) {
                                    if (
                                      err == null &&
                                      (resp.statusCode === 200 ||
                                        resp.statusCode === 202)
                                    ) {
                                      log(
                                        `Avatar was set for Bot #${botdb.indexOf(
                                          bot
                                        ) + 1} - Profile: ${bot.firstname} ${
                                        bot.lastname
                                        }`
                                      );
                                      writeLog(
                                        `Avatar was set for Bot #${botdb.indexOf(
                                          bot
                                        ) + 1} - Profile: ${bot.firstname} ${
                                        bot.lastname
                                        }`,
                                        "Info:"
                                      );
                                      tag = "";
                                      streamline();
                                    } else {
                                      //log_err(err)
                                      avatar();
                                    }
                                  }
                                );
                              } else {
                                //log_err(err)
                                //log_err(resp.body)
                                avatar();
                              }
                            }
                          );
                        } else {
                          //log_err(err)
                          //log_err(resp.body)
                          avatar();
                        }
                      }
                    );
                  } else {
                    //log_err(err)
                    avatar();
                  }
                }
              );
            } else {
              //log_err(err)
              avatar();
            }
          }
        );
      } else {
        //log_err(err)
        avatar();
      }
    });
  }

  function experience() {
    if (tag == "") {
      geturl(false, "experience");
      return;
    }

    var curDate = 0;
    var positions = 0;
    var dates = jobdates[Math.floor(Math.random() * jobdates.length)].split(
      ","
    );
    var current = true;
    var final_job = "";
    var final_jobtitle = "";

    var options_2 = Object.assign({}, options);

    // ------------------ Type deletePosition(), addPosition(), del_add(), del_add(true) or headline() for your purpose ---------------------
    //deletePosition()
    //addPosition()
    del_add(true);
    //headline()
    // -----------------------------------------------------------------------------------------------------------

    function del_add(set_hl = false) {
      deletePosition(set_hl, true);
    }

    function deletePosition(set_hl = false, bAdd = false) {
      var sp_ots = Object.assign({}, options);

      sp_ots["headers"] = {
        authority: "www.linkedin.com",
        method: "GET",
        path: `${tag.replace("https://www.linkedin.com", "")}`,
        scheme: "https",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
        "cache-control": "max-age=0",
        referer: "https://www.linkedin.com/",
        "upgrade-insecure-requests": "1",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36"
      };

      needle.get(`${tag}`, sp_ots, function (err, resp) {
        if (err == null && resp.statusCode === 200) {
          var ver = resp.body.match(/versionTag&quot;:&quot;([0-9]+)/)[1];
          var id = resp.body.match(
            /urn:li:fs_miniProfile:([a-zA-Z0-9_-]*)&quot;,/
          )[1];
          var job = resp.body.match(
            /quot;urn:li:fs_position:\([a-zA-Z0-9_-]*,([0-9]+)\)&quot;/
          );

          if (job !== null) {
            job = job[1];
          } else {
            log(
              `All previous jobs experience deleted for Bot #${botdb.indexOf(
                bot
              ) + 1}`
            );
            writeLog(
              `All previous jobs experience deleted for Bot #${botdb.indexOf(
                bot
              ) + 1}`,
              "Info:"
            );
            if (bAdd) {
              addPosition(set_hl);
            }
            return;
          }

          needle.get(`${tag}/edit/position/${job}/`, sp_ots, function (
            err,
            resp
          ) {
            if (err == null && resp.statusCode === 200) {
              try {
                var inst =
                  resp.body.match(
                    /(urn:li:page:d_flagship3_profile_self_edit_position[a-zA-Z0-9_;+\/]*)/
                  )[1] + "==";
              } catch (err) {
                log_err(
                  `In function Experience for Bot #${botdb.indexOf(bot) +
                  1}, repeating`
                );
                writeLog(
                  `In function Experience for Bot #${botdb.indexOf(bot) +
                  1}, repeating`,
                  "Error:"
                );
                experience();
                return;
              }

              var del_url = `https://www.linkedin.com/voyager/api/identity/profiles/${id}/normPositions/${job}?versionTag=${ver}`;

              sp_ots["headers"] = {
                authority: "www.linkedin.com",
                method: "DELETE",
                path: `/voyager/api/identity/profiles/${id}/normPositions/${job}?versionTag=${ver}`,
                scheme: "https",
                accept: "application/vnd.linkedin.normalized+json+2.1",
                "accept-encoding": "gzip, deflate, br",
                "accept-language":
                  "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
                "csrf-token": bot.csrf,
                origin: "https://www.linkedin.com",
                referer: `${tag}/edit/position/${job}/`,
                "user-agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36",
                "x-li-lang": "en_US",
                "x-li-page-instance": inst,
                "x-li-track":
                  '{"clientVersion":"1.2.4258","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
                "x-requested-with": "XMLHttpRequest",
                "x-restli-protocol-version": "2.0.0"
              };

              needle.delete(del_url, {}, sp_ots, function (err, resp) {
                if (
                  err == null &&
                  (resp.statusCode === 200 || resp.statusCode == 204)
                ) {
                  deletePosition(set_hl, bAdd);
                } else {
                  experience();
                }
              });
            } else {
              experience();
            }
          });
        } else {
          experience();
        }
      });
    }

    function set_headline() {
      options_2["headers"] = {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
        "Content-Type": "application/json; charset=UTF-8",
        "Csrf-Token": bot.csrf,
        Host: "www.linkedin.com",
        Origin: "https://www.linkedin.com",
        Referer: `${tag.replace(
          "https://www.linkedin.com/in/",
          ""
        )}/edit/topcard/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
        "X-LI-Lang": "en_US",
        "X-LI-Track":
          '{"clientVersion":"1.2.2370","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
        "X-Requested-With": "XMLHttpRequest",
        "X-RestLi-Protocol-Version": "2.0.0"
      };

      needle.get(`${tag}/edit/topcard/`, options_2, function (err, resp) {
        if (err == null && resp.statusCode === 200) {
          var body = resp.body;
          var stdate = body.match(
            /{&quot;startDate&quot;:{&quot;year&quot;:([0-9]+)/
          );
          if (stdate !== null) {
            stdate = stdate[1];
          } else {
            log(`No jobs to set headline #${botdb.indexOf(bot) + 1}`);
            writeLog(
              `No jobs to set headline #${botdb.indexOf(bot) + 1}`,
              "Info:"
            );
            tag = "";
            streamline();
            return;
          }
          body = body.slice(body.indexOf(stdate));
          fs.writeFileSync("logg.csv", resp.body);
          var cpid = body.match(/urn:li:fs_miniCompany:([0-9]+)/)[1];
          var a = new RegExp(
            "quot;title&quot;:&quot;([a-zA-Z_ -.]*)&quot;,&quot;companyUrn&quot;:&quot;urn:li:fs_miniCompany:" +
            cpid
          );
          var jobtitle = body.match(a);
          var b = new RegExp(
            "urn:li:fs_miniCompany:" +
            cpid +
            "&quot;,&quot;name&quot;:&quot;([a-zA-Z_ -.&;]*)&quot;,"
          );

          var job = body.match(b);
          if (job !== null && jobtitle !== null) {
            job = job[1];
            jobtitle = jobtitle[1];
          } else {
            log(`No jobs to set headline #${botdb.indexOf(bot) + 1}`);
            writeLog(
              `No jobs to set headline #${botdb.indexOf(bot) + 1}`,
              "Info:"
            );
            tag = "";
            streamline();
            return;
          }

          job = job.split("amp;").join();

          var data = {
            patch: {
              $set: {
                headline: `${jobtitle} at ${job}`
              }
            }
          };

          try {
            var id = resp.body.match(
              /urn:li:fs_miniProfile:([a-zA-Z0-9_-]*)&quot;,/
            )[1];
            var ver = resp.body.match(/versionTag&quot;:&quot;([0-9]+)/)[1];
            var inst = resp.body.match(
              /(urn:li:page:d_flagship3_profile_self_edit_top_card[a-zA-Z0-9_;\/]*)/
            )[1];
          } catch (err) {
            fs.writeFileSync("dettest.html", resp.body, function () { });
            log_err(`In function Details for Bot #${botdb.indexOf(bot) + 1}`);
            writeLog(
              `In function Details for Bot #${botdb.indexOf(bot) + 1}`,
              "Error:"
            );
            details();
            return;
          }

          options_2["headers"] = {
            Accept: "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
            Connection: "keep-alive",
            "Content-Type": "application/json; charset=UTF-8",
            "Csrf-Token": bot.csrf,
            Host: "www.linkedin.com",
            Origin: "https://www.linkedin.com",
            Referer: `${tag.replace(
              "https://www.linkedin.com/in/",
              ""
            )}/edit/topcard/`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
            "X-LI-Lang": "en_US",
            "X-li-page-instance": inst,
            "X-LI-Track":
              '{"clientVersion":"1.2.2430","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
            "X-Requested-With": "XMLHttpRequest",
            "X-RestLi-Protocol-Version": "2.0.0"
          };

          var url = `https://www.linkedin.com/voyager/api/identity/normProfiles/${id}?versionTag=${ver}`;

          needle.post(url, JSON.stringify(data), options_2, function (
            err,
            resp
          ) {
            if (
              err == null &&
              (resp.statusCode === 200 || resp.statusCode === 202)
            ) {
              log(`Headline was successfully set`);
              writeLog(`Headline was successfully set`, "Info:");
              tag = "";
              streamline();
            } else {
              //log_err(err)
              set_headline();
            }
          });
        } else {
          //log_err(err)
          set_headline();
        }
      });
    }

    function headline() {
      var sp_ots = Object.assign({}, options);

      sp_ots["headers"] = {
        authority: "www.linkedin.com",
        method: "GET",
        path: `${tag.replace("https://www.linkedin.com", "")}`,
        scheme: "https",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
        "cache-control": "max-age=0",
        referer: "https://www.linkedin.com/",
        "upgrade-insecure-requests": "1",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36"
      };

      needle.get(`${tag}`, sp_ots, function (err, resp) {
        if (err == null && resp.statusCode === 200) {
          set_headline();
        } else {
          headline();
        }
      });
    }

    function addPosition(set_hl = false) {
      var rn_c = Math.floor(Math.random() * companies.length);
      var rn_t = Math.floor(Math.random() * jobtitles.length);
      if (positions < 3) {
        var jobtitle = jobtitles[rn_t].split(",")[1];
      } else {
        var jobtitle = jobtitles[rn_t].split(",")[2];
      }

      if (positions > 0) {
        current = false;
      }

      options_2["headers"] = {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
        "Content-Type": "application/json; charset=UTF-8",
        "Csrf-Token": bot.csrf,
        Host: "www.linkedin.com",
        Origin: "https://www.linkedin.com",
        Referer: `${tag}/edit/topcard/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
        "X-LI-Lang": "en_US",
        "X-LI-Track":
          '{"clientVersion":"1.2.2370","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
        "X-Requested-With": "XMLHttpRequest",
        "X-RestLi-Protocol-Version": "2.0.0"
      };

      needle.get(`${tag}/edit/position/new/`, options_2, function (err, resp) {
        if (err == null && resp.statusCode === 200) {
          var id = resp.body.match(
            /urn:li:fs_miniProfile:([a-zA-Z0-9_-]*)&quot;,/
          )[1];
          var ver = resp.body.match(/versionTag&quot;:&quot;([0-9]+)/)[1];
          var inst = resp.body.match(
            /(urn:li:page:d_flagship3_profile_self_add_position[a-zA-Z0-9_;\/]*)/
          )[1];

          options_2["headers"] = {
            Accept: "application/vnd.linkedin.normalized+json",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
            Connection: "keep-alive",
            "Csrf-Token": bot.csrf,
            Host: "www.linkedin.com",
            Referer: `${tag}/edit/position/new/`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
            "X-LI-Lang": "en_US",
            "X-li-page-instance": inst,
            "X-LI-Track":
              '{"clientVersion":"1.2.2430","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
            "X-Requested-With": "XMLHttpRequest",
            "X-RestLi-Protocol-Version": "2.0.0"
          };

          var job = companies[rn_c];

          needle.get(
            `https://www.linkedin.com/voyager/api/typeahead/hits?q=federated&query=${encodeURIComponent(
              job
            )}&shouldUseSchoolParams=false&types=List(COMPANY)`,
            options_2,
            function (err, resp) {
              if (err == null && resp.statusCode === 200) {
                var comp = JSON.parse(resp.body);
                var passed = false;

                for (entity of comp.included) {
                  if (
                    entity.name &&
                    entity.name.toUpperCase() == job.toUpperCase()
                  ) {
                    comp = entity.objectUrn.replace(
                      "company",
                      "fs_miniCompany"
                    );
                    passed = true;
                    break;
                  }
                }

                if (!passed) {
                  for (entity of comp.included) {
                    if (
                      entity.name &&
                      entity.name.toUpperCase().indexOf(job.toUpperCase()) !==
                      -1
                    ) {
                      comp = entity.objectUrn.replace(
                        "company",
                        "fs_miniCompany"
                      );
                      job = entity.name;
                      passed = true;
                      break;
                    }
                  }
                }

                if (!passed) {
                  log_err(
                    `Error while getting urn parameter for job for Bot #${botdb.indexOf(
                      bot
                    ) + 1} - ${bot.email}`
                  );
                  log_err(`Retrying with different job, bad query: ${job}`);
                  experience();
                  return;
                }

                options_2.headers = {
                  Accept: "*/*",
                  "Accept-Encoding": "gzip, deflate, br",
                  "Accept-Language":
                    "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
                  Connection: "keep-alive",
                  "Content-Type": "application/json; charset=UTF-8",
                  "Csrf-Token": bot.csrf,
                  Host: "www.linkedin.com",
                  Origin: "https://www.linkedin.com",
                  Referer: `${tag}/edit/position/new/`,
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
                  "X-LI-Lang": "en_US",
                  "X-li-page-instance": inst,
                  "X-LI-Track":
                    '{"clientVersion":"1.2.2430","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
                  "X-Requested-With": "XMLHttpRequest",
                  "X-RestLi-Protocol-Version": "2.0.0"
                };

                var data = {
                  title: jobtitle,
                  timePeriod: {},
                  companyName: job,
                  companyUrn: comp,
                  promotion: false,
                  headline: `${jobtitle} at ${job}`
                };

                if (positions == 0) {
                  final_job = job;
                  final_jobtitle = jobtitle;
                }

                if (current) {
                  data.timePeriod["startDate"] = {
                    year: parseInt(dates[curDate])
                  };
                } else {
                  data.timePeriod["startDate"] = {
                    year: parseInt(dates[curDate + 1])
                  };
                  data.timePeriod["endDate"] = {
                    year: parseInt(dates[curDate])
                  };
                }

                curDate++;

                var url = `https://www.linkedin.com/voyager/api/identity/profiles/${id}/normPositions/?versionTag=${ver}`;

                needle.post(url, JSON.stringify(data), options_2, function (
                  err,
                  resp
                ) {
                  if (err == null && resp.statusCode === 201) {
                    positions++;
                    if (positions < 4) {
                      addPosition(set_hl);
                    } else {
                      if (set_hl) {
                        set_headline();
                      } else {
                        log(
                          `Working experience was filled by Bot #${botdb.indexOf(
                            bot
                          ) + 1} - Profile: ${bot.firstname} ${bot.lastname}`
                        );
                        writeLog(
                          `Working experience was filled by Bot #${botdb.indexOf(
                            bot
                          ) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,
                          "Info:"
                        );
                        tag = "";
                        streamline();
                      }
                    }
                  } else {
                    //log_err(err)
                    //log_err(resp.body)
                    experience();
                  }
                });
              } else {
                experience();
              }
            }
          );
        } else {
          //log_err(err)
          experience();
        }
      });
    }
  }

  function education() {
    if (tag == "") {
      geturl(false, "education");
      return;
    }

    var school = schools[Math.floor(Math.random() * schools.length)];
    var fos = studies[Math.floor(Math.random() * studies.length)];

    var options_2 = Object.assign({}, options);

    options_2["headers"] = {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
      "Content-Type": "application/json; charset=UTF-8",
      "Csrf-Token": bot.csrf,
      Host: "www.linkedin.com",
      Origin: "https://www.linkedin.com",
      Referer: `${tag}/edit/topcard/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      "X-LI-Lang": "en_US",
      "X-LI-Track":
        '{"clientVersion":"1.2.2370","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
      "X-Requested-With": "XMLHttpRequest",
      "X-RestLi-Protocol-Version": "2.0.0"
    };

    needle.get(`${tag}/edit/education/new/`, options_2, function (err, resp) {
      if (err == null && resp.statusCode === 200) {
        var id = resp.body.match(
          /urn:li:fs_miniProfile:([a-zA-Z0-9_-]*)&quot;,/
        )[1];
        var ver = resp.body.match(/versionTag&quot;:&quot;([0-9]+)/)[1];
        var inst = resp.body.match(
          /(urn:li:page:d_flagship3_profile_self_add_education[a-zA-Z0-9_;\/]*)/
        )[1];

        options_2["headers"] = {
          Accept: "application/vnd.linkedin.normalized+json",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
          Connection: "keep-alive",
          "Csrf-Token": bot.csrf,
          Host: "www.linkedin.com",
          Referer: `${tag}/edit/position/new/`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
          "X-LI-Lang": "en_US",
          "X-li-page-instance": inst,
          "X-LI-Track":
            '{"clientVersion":"1.2.2430","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
          "X-Requested-With": "XMLHttpRequest",
          "X-RestLi-Protocol-Version": "2.0.0"
        };

        var url = `https://www.linkedin.com/voyager/api/typeahead/hits?q=federated&query=${encodeURIComponent(
          school
        )}&shouldUseSchoolParams=true&types=List(SCHOOL)`;

        needle.get(url, options_2, function (err, resp) {
          if (err == null && resp.statusCode === 200) {
            var comp = JSON.parse(resp.body);
            var passed = false;

            for (entity of comp.included) {
              if (
                entity.schoolName &&
                entity.schoolName.toUpperCase() == school.toUpperCase()
              ) {
                comp = entity.entityUrn;
                passed = true;
                break;
              }
            }

            if (!passed) {
              for (entity of comp.included) {
                if (
                  entity.schoolName &&
                  entity.schoolName
                    .toUpperCase()
                    .indexOf(school.toUpperCase()) !== -1
                ) {
                  comp = entity.entityUrn;
                  school = entity.name;
                  passed = true;
                  break;
                }
              }
            }

            if (!passed) {
              log_err(
                `Error while getting urn parameter for school for Bot #${botdb.indexOf(
                  bot
                ) + 1} - ${bot.email}`
              );
              log_err(`Retrying with different school, bad query: ${school}`);
              education();
              return;
            }

            options_2.headers = {
              Accept: "*/*",
              "Accept-Encoding": "gzip, deflate, br",
              "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
              Connection: "keep-alive",
              "Content-Type": "application/json; charset=UTF-8",
              "Csrf-Token": bot.csrf,
              Host: "www.linkedin.com",
              Origin: "https://www.linkedin.com",
              Referer: `${tag}/edit/education/new/`,
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
              "X-LI-Lang": "en_US",
              "X-li-page-instance": inst,
              "X-LI-Track":
                '{"clientVersion":"1.2.2430","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
              "X-Requested-With": "XMLHttpRequest",
              "X-RestLi-Protocol-Version": "2.0.0"
            };

            var data = {
              fieldOfStudy: fos,
              schoolUrn: comp,
              schoolName: school
            };

            var url = `https://www.linkedin.com/voyager/api/identity/profiles/${id}/normEducations/?versionTag=${ver}`;

            needle.post(url, JSON.stringify(data), options_2, function (
              err,
              resp
            ) {
              if (err == null && resp.statusCode === 201) {
                log(
                  `Education was filled by Bot #${botdb.indexOf(bot) +
                  1} - Profile: ${bot.firstname} ${bot.lastname}`
                );
                writeLog(
                  `Education was filled by Bot #${botdb.indexOf(bot) +
                  1} - Profile: ${bot.firstname} ${bot.lastname}`,
                  "Info:"
                );
                tag = "";
                streamline();
              } else {
                //log_err(err)
                //log_err(resp.body)
                education();
              }
            });
          } else {
            education();
          }
        });
      } else {
        //log_err(err)
        education();
      }
    });
  }

  function skillset(deleted) {
    if (tag == "") {
      geturl(false, "skillset");
      return;
    }

    var options_2 = Object.assign({}, options);

    options_2["headers"] = {
      Accept: "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
      "Content-Type": "application/json; charset=UTF-8",
      "Csrf-Token": bot.csrf,
      Host: "www.linkedin.com",
      Origin: "https://www.linkedin.com",
      Referer: `${tag}/edit/topcard/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      "X-LI-Lang": "en_US",
      "X-LI-Track":
        '{"clientVersion":"1.2.2370","osName":"web","timezoneOffset":8,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
      "X-Requested-With": "XMLHttpRequest",
      "X-RestLi-Protocol-Version": "2.0.0"
    };

    needle.get(`${tag}/detail/skills/add/`, options_2, function (err, resp) {
      if (err == null && resp.statusCode === 200) {
        var id = resp.body.match(
          /urn:li:fs_miniProfile:([a-zA-Z0-9_-]*)&quot;,/
        )[1];
        var ver = resp.body.match(/versionTag&quot;:&quot;([0-9]+)/)[1];
        var inst = resp.body.match(
          /(urn:li:page:d_flagship3_profile_self_skill_typeahead[a-zA-Z0-9_;\/]*)/
        )[1];

        if (!deleted) {
          options_2.headers = {
            authority: "www.linkedin.com",
            method: "POST",
            path: `/voyager/api/identity/profiles/${id}/normSkills?action=editSkills&versionTag=${ver}`,
            scheme: "https",
            accept: "application/vnd.linkedin.normalized+json+2.1",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
            Connection: "keep-alive",
            "Content-Type": "application/json; charset=UTF-8",
            "Csrf-Token": bot.csrf,
            Host: "www.linkedin.com",
            Origin: "https://www.linkedin.com",
            Referer: `${tag}/detail/skills/add/`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
            "x-li-lang": "en_US",
            "x-li-page-instance": inst,
            "x-li-track":
              '{"clientVersion":"1.2.2535","osName":"web","timezoneOffset":0,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
            "x-requested-with": "XMLHttpRequest",
            "x-restli-protocol-version": "2.0.0"
          };

          var data = { normSkills: { normSkills: [] }, versionTag: ver };

          var url = `https://www.linkedin.com/voyager/api/identity/profiles/${id}/normSkills?action=editSkills&versionTag=${ver}`;

          needle.post(url, JSON.stringify(data), options_2, function (
            err,
            resp
          ) {
            if (err == null && resp.statusCode === 200) {
              log(
                `Old skills were deleted by Bot #${botdb.indexOf(bot) +
                1} - Profile: ${bot.firstname} ${bot.lastname}`
              );
              writeLog(
                `Old skills were deleted by Bot #${botdb.indexOf(bot) +
                1} - Profile: ${bot.firstname} ${bot.lastname}`,
                "Info:"
              );
              //setTimeout(() => skillset(true), 5000)
              skillset(true);
              return;
            } else {
              log_err(err);
              log_err(resp.body);
              skillset();
            }
          });
        } else {
          options_2.headers = {
            authority: "www.linkedin.com",
            method: "POST",
            path: `/voyager/api/identity/profiles/${id}/normSkills?versionTag=${ver}`,
            scheme: "https",
            accept: "application/vnd.linkedin.normalized+json+2.1",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6",
            "Content-Type": "application/json; charset=UTF-8",
            "Csrf-Token": bot.csrf,
            Origin: "https://www.linkedin.com",
            Referer: `${tag}/guided/add-skills/skills/?contextType=PROFILE_COMPLETION_METER`,
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
            "x-li-lang": "en_US",
            "x-li-page-instance": inst,
            "x-li-track":
              '{"clientVersion":"1.3.323","osName":"web","timezoneOffset":0,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
            "x-requested-with": "XMLHttpRequest",
            "x-restli-method": "BATCH_CREATE",
            "x-restli-protocol-version": "2.0.0"
          };

          var sk = "";

          var data = {
            elements: []
          };

          var indexes = [];

          while (data.elements.length < 20) {
            var index = Math.floor(Math.random() * skills.length);
            sk = skills[index];
            if (indexes.indexOf(index) == -1) {
              data.elements.push({ name: sk });
              indexes.push(index);
            }
          }

          var url = `https://www.linkedin.com/voyager/api/identity/profiles/${id}/normSkills/?versionTag=${ver}`;

          needle.post(url, JSON.stringify(data), options_2, function (
            err,
            resp
          ) {
            if (err == null && resp.statusCode === 200) {
              log(
                `20 skills were added by Bot #${botdb.indexOf(bot) +
                1} - Profile: ${bot.firstname} ${bot.lastname}`
              );
              writeLog(
                `20 skills were added by Bot #${botdb.indexOf(bot) +
                1} - Profile: ${bot.firstname} ${bot.lastname}`,
                "Info:"
              );
              tag = "";
              streamline();
            } else {
              log_err(err);
              log_err(resp.body);
              skillset();
            }
          });
        }
      } else {
        log_err(err);
        skillset();
      }
    });
  }

  function changepw() {
    var options_2 = Object.assign({}, options);

    options_2["headers"] = {
      authority: "www.linkedin.com",
      method: "POST",
      path: "/psettings/change-password",
      scheme: "https",
      accept: "*/*",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: "https://www.linkedin.com",
      referer: "https://www.linkedin.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      "x-requested-with": "XMLHttpRequest"
    };

    data = {
      oldPassword: bot.pass,
      newPassword: "986745yuna",
      newPasswordConfirm: "986745yuna",
      csrfToken: bot.csrf,
      isSignOutOfAllSessions: true
    };

    needle.post(
      "https://www.linkedin.com/psettings/change-password",
      data,
      options_2,
      function (err, resp) {
        if (err == null && resp.statusCode === 200) {
          log(
            `Password was changed by Bot #${botdb.indexOf(bot) +
            1} - Profile: ${bot.firstname} ${bot.lastname}`
          );
          writeLog(
            `Password was changed by Bot #${botdb.indexOf(bot) +
            1} - Profile: ${bot.firstname} ${bot.lastname}`,
            "Info:"
          );
          streamline();
        } else {
          //log_err(err)
          changepw();
        }
      }
    );
  }

  function invitesettings() {
    var options_2 = Object.assign({}, options);

    options_2["headers"] = {
      authority: "www.linkedin.com",
      method: "POST",
      path: "/psettings/invite-receive",
      scheme: "https",
      accept: "*/*",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: "https://www.linkedin.com",
      referer: "https://www.linkedin.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      "x-requested-with": "XMLHttpRequest"
    };

    data = {
      dataKey: "howToReceiveInvitation",
      el: "#setting-invite-receive",
      settingsUrls: "[object Object]",
      name: "invite-receive",
      locale: "en_US",
      isNotCnDomain: "true",
      headerData: "[object Object]",
      path: "/psettings/invite-receive",
      blockInviteType: "BLOCK_NO_INVITATIONS",
      lixTests: "[object Object]",
      pageTitle: "Types of invites you'd like to receive",
      settingVisibility: "[object Object]",
      device: "DESKTOP",
      setting: "invite-receive",
      initialFetch: "true",
      dataVal: "BLOCK_RECONNECT_ACCEPT_STD",
      hasSuccess: "true",
      errors: "[object Object]",
      inviteReceiveParam: "BLOCK_NO_INVITATIONS",
      csrfToken: bot.csrf
    };

    needle.post(
      "https://www.linkedin.com/psettings/invite-receive",
      data,
      options_2,
      function (err, resp) {
        if (err == null && resp.statusCode === 200) {
          log(
            `Invite settings changed by Bot #${botdb.indexOf(bot) +
            1} - Profile: ${bot.firstname} ${bot.lastname}`
          );
          writeLog(
            `Invite settings changed by Bot #${botdb.indexOf(bot) +
            1} - Profile: ${bot.firstname} ${bot.lastname}`,
            "Info:"
          );
          streamline();
        } else {
          //log_err(err)
          invitesettings();
        }
      }
    );
  }

  function acceptinvites() {
    var options_2 = Object.assign({}, options);

    options_2["headers"] = {
      authority: "www.linkedin.com",
      method: "POST",
      path: "/psettings/invite-receive",
      scheme: "https",
      accept: "*/*",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: "https://www.linkedin.com",
      referer: "https://www.linkedin.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
      "x-requested-with": "XMLHttpRequest"
    };

    needle.get(
      "https://www.linkedin.com/mynetwork/invitation-manager/",
      options_2,
      function (err, resp) {
        if (err == null && resp.statusCode === 200) {
          var inst = resp.body.match(
            /(urn:li:page:d_flagship3_people_invitations[a-zA-Z0-9_;\/]*)/
          )[1];

          var invites = resp.body
            .replace(/&quot;/g, "")
            .match(/invitation:(urn:li:fs_relInvitation:[0-9]+)/g);
          var shared = resp.body
            .replace(/&quot;/g, "")
            .match(/sharedSecret:([a-zA-Z0-9]+)/g);

          if (invites == null || shared == null) {
            log(
              `All invites accepted by Bot #${botdb.indexOf(bot) +
              1} - Profile: ${bot.firstname} ${bot.lastname}`
            );
            writeLog(
              `All invites accepted by Bot #${botdb.indexOf(bot) +
              1} - Profile: ${bot.firstname} ${bot.lastname}`,
              "Info:"
            );
            streamline();
          } else {
            if (invites.length !== shared.length) {
              log_err(
                `Something wrong with invitations for Bot #${botdb.indexOf(
                  bot
                ) + 1} - Profile: ${bot.firstname} ${bot.lastname}`
              );
              writeLog(
                `Something wrong with invitations for Bot #${botdb.indexOf(
                  bot
                ) + 1} - Profile: ${bot.firstname} ${bot.lastname}`,
                "Error:"
              );
              acceptinvites();
            } else {
              options_2["headers"] = {
                authority: "www.linkedin.com",
                method: "POST",
                path:
                  "/voyager/api/relationships/invitations?action=closeInvitations",
                scheme: "https",
                accept: "application/vnd.linkedin.normalized+json+2.1",
                "accept-encoding": "gzip, deflate, br",
                "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
                "content-type": "application/json; charset=UTF-8",
                "csrf-token": bot.csrf,
                origin: "https://www.linkedin.com",
                referer:
                  "https://www.linkedin.com/mynetwork/invitation-manager/",
                "user-agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36",
                "x-li-lang": "en_US",
                "x-li-page-instance": inst,
                "x-li-track":
                  '{"clientVersion":"1.2.2535","osName":"web","timezoneOffset":0,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
                "x-requested-with": "XMLHttpRequest",
                "x-restli-protocol-version": "2.0.0"
              };

              var data = {
                inviteActionType: "ACCEPT",
                inviteActionData: []
              };

              for (var i = 0; i < invites.length; i++) {
                data.inviteActionData.push({
                  entityUrn: invites[i].replace("invitation:", ""),
                  validationToken: shared[i].replace("sharedSecret:", "")
                });
              }

              needle.post(
                "https://www.linkedin.com/voyager/api/relationships/invitations?action=closeInvitations",
                JSON.stringify(data),
                options_2,
                function (err, resp) {
                  if (err == null && resp.statusCode === 200) {
                    acceptinvites();
                  } else {
                    //log_err(err)
                    //log_err(resp.body)
                    acceptinvites();
                  }
                }
              );
            }
          }
        } else {
          //log_err(err)
          acceptinvites();
        }
      }
    );

    //https://www.linkedin.com/mynetwork/invitation-manager/
    //
  }

  function headline() { }
}, number_of_instances);

bots.drain = function () {
  console.log("All Done");
  writeLog("All Done!", "Info:");
};

var botsActive = [];
var oldBots = [];
var botStart = 0;

fs.readdirSync(__dirname).forEach(file => {
  if (file.indexOf(".lock") !== -1) {
    oldBots.push(parseInt(file.replace("bot", "").replace(".lock", "")));
  }
});

oldBots.sort(function (a, b) {
  return a - b;
});

if (oldBots.length > 0) {
  botStart = oldBots[oldBots.length - 1];
}

fs.readdirSync(__dirname).forEach(file => {
  if (file.indexOf(".lock") !== -1) {
    if (fs.existsSync(`log.txt`)) {
      fs.unlink(file, function (err, res) {
        if (err) {
          console.log("error", err);
        }
      });
    }
  }
  if (file == "log.txt") {
    if (fs.existsSync(`log.txt`)) {
      fs.unlink("log.txt", function (err, res) {
        if (err) console.log("error", err);
      });
    } else {
      //console.log('no')
    }
  }
});

for (i = 0; i < oldBots.length; i++) {
  botsActive.push(botdb[oldBots[i] - 1]);
}

for (i = botStart; i < botdb.length; i++) {
  botsActive.push(botdb[i]);
}

bots.push(botsActive);

function skippedBots(botNum) {
  var data = `${botNum + 1}\n`;

  fs.appendFile("skipped.txt", "\ufeff" + data, { encoding: "utf-8" }, function (
    err
  ) {
    if (err) {
      //console.log(err);
      // append failed
    }
  });
}

function writeLog(message, type) {
  console.log(message);
  var data = `${moment(new Date()).format(
    "YYYY-MM-DD HH:mm:ss"
  )} [${type}] ${message}\n`;

  fs.appendFile("log.txt", "\ufeff" + data, { encoding: "utf-8" }, function (
    err
  ) {
    if (err) {
      console.log(err);
      // append failed
    }
  });
}
