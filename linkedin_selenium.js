var request = require('request');
var tress = require('tress');
var cheerio = require('cheerio');
var needle = require('needle')
var moment = require('moment');
var fs = require('fs');
var log = require('debug')('Info:')
var log_err = require('debug')('Error:')

log.color = 6
log_err.color = 2

var number_of_instances = 10;

webdriver = require('selenium-webdriver')
proxy = require('selenium-webdriver/proxy')
chrome= require('selenium-webdriver/chrome')
By = webdriver.By
until = webdriver.until
path = require('chromedriver').path
service = new chrome.ServiceBuilder(path).build();
chrome.setDefaultService(service)

	clientdb = fs.readFileSync('clientdb.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);
		
	botdb = fs.readFileSync('botdb.csv', 'utf-8')
		.split('\r\n')
		.filter(Boolean);

	clientdb.forEach(function(cur,ind,arr){
		const num = arr[ind].split(',')
		arr[ind] = num
		if (!num[1]) {
			arr[ind][3] = 1
			arr[ind][2] = 1
			arr[ind][1] = 1
			arr[ind][4] = botdb.length
		}
		console.log(arr[ind])
	})
		
	botdb.forEach(function(cur,ind,arr){
		var tmp = arr[ind].split(',')
		arr[ind] = {
			proxy: tmp[0],
			port: tmp[1],
			email: tmp[2],
			name: tmp[3],
			pass: tmp[4]
		}
	})
	
	var opType = process.argv[3] || 'connect'

var bots = tress(function(bot,callback){

	if (!bot.email || !bot.pass) {
		record(`Skipping Bot #${botdb.indexOf(bot) + 1} (Username or Password does not exist)`,'Error')
		botsActive.splice(botsActive.indexOf(bot),1)
		callback()
		return
	}
	
	fs.writeFile(`bot${(botdb.indexOf(bot) + 1)}.lock`, phase, {encoding: 'utf-8'} , function (err) {
		if (err) {
			console.log(err);
		// append failed
		}
	})
	
	var login_tries = 0;
	var login_done = false
	var target_max = 0;
	var connect_max = 0;
	var errors = 0;
	var mail_max = 0;
	var called = false;
	
		var options = {
			compressed         : true,
			rejectUnauthorized : false,
			open_timeout: 10000,
			response_timeout: 10000,
			read_timeout: 10000,
			proxy: bot.proxy + ':' + bot.port
		}
		
		options['headers'] = {
			'authority': 'www.linkedin.com',
			'method': 'POST',
			'path': '/checkpoint/lg/login-submit',
			'scheme': 'https',
			'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
			'accept-encoding': 'gzip, deflate, br',
			'accept-language': 'en-US,en;q=0.9',
			'cache-control': 'max-age=0',
			'content-type': 'application/x-www-form-urlencoded',
			'origin': 'https://www.linkedin.com',
			'referer': 'https://www.linkedin.com/login?trk=guest_homepage-basic_nav-header-signin',
			'upgrade-insecure-requests': '1',
			'User-Agent':'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36'
		}
		
		log(`Logging in Bot #${botdb.indexOf(bot) + 1} - ${bot.email}`)
		record(`Logging in Bot #${botdb.indexOf(bot) + 1} - ${bot.email}`,'Info:')
		login()
	
		function login(){
			
			login_tries++;
	
			if (login_tries >= 4) {
				log(`Login failed on Bot #${botdb.indexOf(bot) + 1} (${bot.name} <-> Proxy error)`,'Error')
				fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, function(){});
				botsActive.splice(botsActive.indexOf(bot),1)
				skippedBots(botdb.indexOf(bot))
				callback()
				return
			}
	
			var url = 'https://www.linkedin.com/login?trk=guest_homepage-basic_nav-header-signin'
	
			needle.get(url, options, function(err, resp){
	
				if ((err == null) && resp.statusCode === 200) {
					var $ = cheerio.load(resp.body)
	
					var csrf = $('input[name="loginCsrfParam"]').attr('value')
					var ck = resp.cookies
	
					options['cookies'] = 0
						
					var url = 'https://www.linkedin.com/checkpoint/lg/login-submit'
	
					if(options['cookies'] == undefined){
						login()
						return
					}
	
					needle.post(url, {session_key:bot.email,session_password:bot.pass,isJsEnabled:false,loginCsrfParam:csrf}, options, async function(err, resp){
	
						if ((err == null) && (resp.statusCode === 302 || resp.statusCode == 303 || resp.statusCode === 200)) {
	
							var $ = cheerio.load(resp.body)
	
							if($('#challengeContent').length !== 0){
								log_err(`Captcha! Solving for bot #${botdb.indexOf(bot) + 1} - ${bot.email}`)
								var ck = await solveCaptcha()
								if(ck !== false){
									record_cookie(ck,true)
								} else {
									log_err(`Error on login: captcha or wrong password, skipping the ${bot.email}`)
									if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
										fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
									}
									skippedBots(botdb.indexOf(bot))
									callback()
									return
								}			
							} else if($(`#idverifyUrl`).length !== 0 || $(`#pagekey-uas-account-restricted`).length !== 0 || resp.body.indexOf('href="/checkpoint/challenge/') !== -1 || (resp.headers['location'] && resp.headers['location'].indexOf('/checkpoint/challenge/') !== -1)){
								
								if(resp.body.indexOf('href="/checkpoint/challenge/') !== -1 || (resp.headers['location'] && resp.headers['location'].indexOf('/checkpoint/challenge/') !== -1)){
	
									var loc = resp.headers['location']
	
									if(loc == undefined){
										log_err(`Profile Banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`)
										record(`Profile Banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`,'Error:')
										if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
											fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, function(){})
										}
										skippedBots(botdb.indexOf(bot))
										callback()
										return
									}
	
									options.cookies['chp_token'] = resp.cookies['chp_token']
	
									needle.get(`https://www.linkedin.com${resp.headers['location']}`, options, async function(err, resp){
	
										if(!resp && !resp.body){
											log_err(`Nothing sent back for Bot #${botdb.indexOf(bot) + 1}, retrying`)
											record(`Nothing sent back for Bot #${botdb.indexOf(bot) + 1}, retrying`,'Error:')
											callback()
											return
										}
	
										if(resp.body.indexOf('captchaV2Challenge') !== -1){
											log_err(`Captcha! Solving - ${bot.email}`)
											var ck = await solveCaptcha()
											if(ck !== false){
												record_cookie(ck,true)
												return
											} else {
												log_err(`Error on login: captcha or wrong password, skipping the ${bot.email}`)
												if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
													fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
												}
												skippedBots(botdb.indexOf(bot))
												callback()
												return
											}
										}
	
										var $ = cheerio.load(resp.body)
										
										var test = {
											csrfToken: $('input[name="csrfToken"]').attr('value'),
											pageInstance: $('meta[name="pageInstance"]').attr('content'),
											resendUrl: '/checkpoint/challenge/resend',
											challengeId: $('input[name="challengeId"]').attr('value'),
											language: 'en-US',
											displayTime: $('input[name="displayTime"]').attr('value'),
											challengeSource: $('input[name="challengeSource"]').attr('value'),
											requestSubmissionId: $('input[name="requestSubmissionId"]').attr('value'),
											challengeType: $('input[name="challengeType"]').attr('value'),
											challengeData: $('input[name="challengeData"]').attr('value'),
											failureRedirectUri: $('input[name="failureRedirectUri"]').attr('value'),
											pin: ''
										}
	
										if(test.csrfToken == undefined || test.pageInstance == undefined || test.requestSubmissionId == undefined){
											log_err(`General Error Login(or profile banned) - unknown LinkedIn error. Skipping Bot #${botdb.indexOf(bot) + 1}`)
											record(`General Error Login(or profile banned) - unknown LinkedIn error. Skipping Bot #${botdb.indexOf(bot) + 1}`,'Error:')
											skippedBots(botdb.indexOf(bot))
											callback()
											return
										}
	
										log_err(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`)
										record(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`,'Error:')
	
										var cnt = 0
										var pins = await mailconfirm()
	
										pin_submit()
	
										function pin_submit(){
	
											var obj = {
												csrfToken: $('input[name="csrfToken"]').attr('value'),
												pageInstance: $('meta[name="pageInstance"]').attr('content'),
												resendUrl: '/checkpoint/challenge/resend',
												challengeId: $('input[name="challengeId"]').attr('value'),
												language: 'en-US',
												displayTime: $('input[name="displayTime"]').attr('value'),
												challengeSource: $('input[name="challengeSource"]').attr('value'),
												requestSubmissionId: $('input[name="requestSubmissionId"]').attr('value'),
												challengeType: $('input[name="challengeType"]').attr('value'),
												challengeData: $('input[name="challengeData"]').attr('value'),
												failureRedirectUri: $('input[name="failureRedirectUri"]').attr('value'),
												pin: pins[cnt]
											}
	
											options['headers'] = {
												'authority': 'www.linkedin.com',
												'method': 'POST',
												'path': '/checkpoint/challenge/verify',
												'scheme': 'https',
												'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
												'accept-encoding': 'gzip, deflate, br',
												'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
												'cache-control': 'max-age=0',
												'content-type': 'application/x-www-form-urlencoded',
												'origin': 'https://www.linkedin.com',
												'referer': `https://www.linkedin.com${loc}`,
												'upgrade-insecure-requests': '1',
												'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36'
											}
	
											options.follow_max = 5
											options.follow_set_cookies = true
	
											needle.post(`https://www.linkedin.com/checkpoint/challenge/verify`, obj, options, async function(err, resp){
	
												if ((err == null) && (resp.statusCode === 200)) {
													var $ = cheerio.load(resp.body)
	
													fs.writeFileSync('pintry.html',resp.body,function(){})
	
													if(resp.body.indexOf('a href="/feed/"') == -1){
														if(resp.body.indexOf('verification') !== -1){
															cnt++
															if(cnt !== pins.length){
																pin_submit()
															} else {
																log_err(`No more pins! Skipping Bot #${botdb.indexOf(bot) + 1}`)
																record(`No more pins! Skipping Bot #${botdb.indexOf(bot) + 1}`,'Error:')
																skippedBots(botdb.indexOf(bot))
																callback()
																return
															}
														} else {
															log(`Entered pin for Bot #${botdb.indexOf(bot) + 1}, logging again`)
															record(`Entered pin for Bot #${botdb.indexOf(bot) + 1}, logging again`,'Info:')
															delete options.follow_max
															delete options.follow_set_cookies
															login()
															return
														}
													} else {
														log(`Entered pin for Bot #${botdb.indexOf(bot) + 1}, logging again`)
														record(`Entered pin for Bot #${botdb.indexOf(bot) + 1}, logging again`,'Info:')
														delete options.follow_max
														delete options.follow_set_cookies
														login()
														return
													}
													
												} else {
													log(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`)
													record(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`,'Info:')
													login_done = true
													options.follow_max = 5
													options.follow_set_cookies = true
													processing()
												}
											})
										}
	
										return
	
									})
	
	
								} else {
									log_err(`Profile Banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`)
									record(`Profile Banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`,'Error:')
									if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
										fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
									}
									skippedBots(botdb.indexOf(bot))
									callback()
									return
								}			
							} else if($(`#session_password-login-error`).length !== 0){
								log_err(`Wrong Password! Skipping - ${bot.email}`)
								record(`Wrong Password! Skipping - ${bot.email}`,'Error:')
								if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
									fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
								}
								skippedBots(botdb.indexOf(bot))
								callback()
								return
							} else if($(`form[name="ATOPinChallengeForm"]`).length !== 0){
								log_err(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`)
								record(`Pin requested for Bot #${botdb.indexOf(bot) + 1}!`,'Error:')
								var dts = $('input[name="dts"]').attr('value')
								var treeId = $('meta[name="treeID"]').attr('content')
								var chal_id = $('input[name="security-challenge-id"]').attr('value')
								var alias = $('input[name="sourceAlias"]').attr('value')
								var pins = await mailconfirm()
	
								options['headers'] = {
									'authority': 'www.linkedin.com',
									'method': 'POST',
									'path': '/uas/ato-pin-challenge-submit',
									'scheme': 'https',
									'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
									'accept-encoding': 'gzip, deflate, br',
									'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
									'cache-control': 'max-age=0',
									'content-type': 'application/x-www-form-urlencoded',
									'origin': 'https://www.linkedin.com',
									'referer': 'https://www.linkedin.com/',
									'upgrade-insecure-requests': 1,
									'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.67 Safari/537.36'
								}
	
								var new_cookies = resp.headers['set-cookie']
	
								if(!new_cookies){
									log_err(`3Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
									record(`3Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
									console.log(`CSRF: ${bot.csrf}`)
									console.log(`Cookies: ${bot.cookies}`)
									console.log(`Headers: ${resp.headers}`)
									log_err('')
									setTimeout(login,4000)
									return
								}
	
								for(cookie of new_cookies){
									var name = cookie.match(/([^.]*?)=([^.]*?);/)[1]
									var val = cookie.match(/([^.]*?)=([^.]*?);/)[2]
	
									if(val.indexOf('delete') == -1){
										val = val.replace(/"/g,'')
										options.cookies[`${name}`] = val
									}
								}
	
								var cnt = 0
								pin_submit_2()
	
								function pin_submit_2(){
	
									var obj = {
										PinVerificationForm_pinParam: pins[cnt],
										signin: 'Submit',
										'security-challenge-id': chal_id,
										dts: dts,
										origSourceAlias: '',
										csrfToken: resp.cookies['JSESSIONID'],
										sourceAlias: alias
									}
	
										needle.post(`https://www.linkedin.com/uas/ato-pin-challenge-submit`, obj, options, async function(err, resp){
	
										if ((err == null) && (resp.statusCode === 200)) {
											var $ = cheerio.load(resp.body)
	
											if($(`form[name="ATOPinChallengeForm"]`).length !== 0){
												console.log('Trying next pin')
												record(`Trying next pin`,'Note:')
												cnt++
												if(cnt < pins.length){
													pin_submit_2()
												} else {
													console.log(`No more pins! Skipping - ${bot.email}`)
													record(`No more pins! Skipping - ${bot.email}`,'Note:')
													if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
														fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
													}
													skippedBots(botdb.indexOf(bot))
													callback()
												}				
											} else {
												record_cookie(resp.headers)
											}
	
											fs.writeFileSync('t.html',resp.body,function(){})
										} else {
											console.log(err)
											record(err,'Error:')
										}
									})
								}
	
							} else {
								fs.writeFileSync('ttest.html',resp.body,function(){})
							//	await solveCaptcha()
								record_cookie(resp.headers)
							}
	
							function record_cookie(headers,cap,body){
								function proceed(newOptionsCookies = true){
									log(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`)
									record(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`,'Info:')
									login_done = true
									if(newOptionsCookies){
										options.cookies = bot.cookies
									}
									options.follow_max = 5
									options.follow_set_cookies = true
									processing()
								}
								if(!cap){
									if('location' in headers && isRedirectUrl(headers['location']))
									{
										bot.csrf = options.cookies.JSESSIONID;
										proceed(false);
										return;
									}
	
									var new_cookies = headers['set-cookie']
									bot.cookies = options['cookies']
	
									if(!new_cookies){
										log_err(`1Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
										record(`1Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
										console.log(`CSRF: ${util.inspect(bot.csrf)}`)
										console.log(`Cookies: ${util.inspect(bot.cookies)}`)
										console.log(`Headers: ${util.inspect(headers)}`)
										console.log(`Body: ${body}`)
										setTimeout(login,4000)
										return
									}
	
									// for(cookie of new_cookies){
									// 	var name = cookie.match(/([^.]*?)=([^.]*?);/)[1]
									// 	var val = cookie.match(/([^.]*?)=([^.]*?);/)[2]
	
									// 	if(val.indexOf('delete') == -1){
									// 		val = val.replace(/"/g,'')
									// 		bot.cookies[`${name}`] = val
									// 	}
									// }
	
									if((bot.csrf == '' || bot.csrf === undefined) && (bot.cookies !== '' || bot.cookies !== undefined)){
										var new_cookies = resp.headers['set-cookie']
										bot.cookies = options['cookies']
										//console.log(bot.cookies)
			
										for(cookie of new_cookies){
											var name = cookie.match(/([^.]*?)=([^.]*?);/)[1]
											var val = cookie.match(/([^.]*?)=([^.]*?);/)[2]
			
											if(val.indexOf('delete') == -1){
												val = val.replace(/"/g,'')
												bot.cookies[`${name}`] = val
											}
										}
			
										bot.csrf = resp.cookies.JSESSIONID
			
										if(bot.csrf && !login_done){
											//console.log(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`)
											log(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`)
											record(`Login for Bot #${botdb.indexOf(bot) + 1} complete! (${bot.email})`,'Info:')
											login_done = true
											options.cookies = bot.cookies
					
											processing()
										} else {
											login()
										}
									} else {
										log_err(`2Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
										record(`2Some login error? On Bot #${botdb.indexOf(bot) + 1} and ${bot.email}`)
										console.log(`CSRF: ${bot.csrf}`)
										console.log(`Cookies: ${bot.cookies}`)
										console.log(`Headers: ${resp.headers}`)
										log_err('')
										setTimeout(login,4000)
										return
									}
								} else {
									for(cookie of headers){
										var name = cookie.name
										var val = cookie.value
										bot.cookies = {}
										if(val.indexOf('delete') == -1){
											val = val.replace(/"/g,'')
											bot.cookies[`${name}`] = val
										}
									}
	
									bot.csrf = bot.cookies['JSESSIONID']
	
									if(bot.csrf && !login_done){
										proceed();
									} else {
										callback(true)
									}
								}
							}
										
						} else {
							console.log('login Error')
							log_err(err)
							record(err,'Error:')
							login()
						}
					})
				} else {
					console.log('login Error1')
					log_err(err)
					record(err,'Error:')
					login()
				}
	
			})
	
		}
	
		function isRedirectUrl(location){
			return location.includes('redir');
		}
	
		function mailconfirm(repeated){
			console.log('mailconfirm')
			return new Promise(function(resolve,reject){
	
				var getMails_tries = 0
				function getMails(){
	
					getMails_tries++;
	
					if (getMails_tries >= 4) {
						log(`getMails failed on Bot #${botdb.indexOf(bot) + 1} ${bot.name}`,'Error')
						fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, function(){});
						botsActive.splice(botsActive.indexOf(bot),1)
						skippedBots(botdb.indexOf(bot))
						callback()
						return
					}
	
					var options = {
						compressed         : true,
						rejectUnauthorized : false,
						open_timeout: 10000,
						response_timeout: 10000,
						read_timeout: 10000,
						proxy: bot.proxy + ':' + bot.port
					}
				
					options['headers'] = {
						'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
						'Accept-Encoding': 'gzip, deflate, br',
						'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
						'Connection': 'keep-alive',
						'Host': 'mail.ru',
						'Upgrade-Insecure-Requests': 1,
						'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
					}
	
					needle.get(`https://mail.ru/`, options, function(err, resp){
	
						if ((err == null) && resp.statusCode === 200) {
							options['cookies'] = resp.cookies
							options['headers'] = {
								'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
								'Accept-Encoding': 'gzip, deflate, br',
								'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
								'Cache-Control': 'max-age=0',
								'Connection': 'keep-alive',
								'Content-Type': 'application/x-www-form-urlencoded',
								'Host': 'auth.mail.ru',
								'Origin': 'https://mail.ru',
								'Referer': 'https://mail.ru/',
								'Upgrade-Insecure-Requests': 1,
								'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36'
							}
							options.follow_max = 15
							options.follow_set_cookies = true
	
							var bot_auth = {
								Login: bot.email,
								Domain: 'mail.ru',
								Password: bot.passMail,
								saveauth: 0,
								FromAccount: 0,
								token: resp.cookies['act']
							}
	
							needle.post(`https://auth.mail.ru/cgi-bin/auth?from=splash`,bot_auth, options, function(err, resp){
								if ((err == null) && resp.statusCode === 200) {
									options['cookies'] = Object.assign(options['cookies'],resp.cookies)
	
									var token = resp.body.match(/patron.updateToken\("([a-zA-Z0-9:]+)/)
									if(token !== null){
										token = token[1]
									} else {
										console.log(`Token Error for Bot #${botdb.indexOf(bot) + 1}(mailru), repeating`)
										record(`Token Error for Bot #${botdb.indexOf(bot) + 1}(mailru), repeating`,'Error:')
										if(repeated){
											console.log(`2nd Token Error for Bot #${botdb.indexOf(bot) + 1}(mailru), skipping`)
											record(`2nd Token Error for Bot #${botdb.indexOf(bot) + 1}(mailru), skipping`)
											if(fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
												fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
											}
											skippedBots(botdb.indexOf(bot))
											callback()
											return
										} else {
											mailconfirm(true)
											return
										}
									}
	
									var date = new Date()
									date = date.getTime()
									
									var rnd = Math.random()
	
									var obj = {'__urlp':`/threads/status/smart?ajax_call=1&x-email=${bot.email.replace('@','%40')}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date}&email=${bot.email.replace('@','%40')}&sort=%7B%22type%22%3A%22date%22%2C%22order%22%3A%22desc%22%7D&offset=0&limit=26&folder=0&htmlencoded=false&last_modified=-1&filters=%7B%7D&letters=true&nolog=1&sortby=D&rnd=${rnd}&api=1&token=${token.replace(':','%3A')}`}
	
									options['headers'] = {
										'Accept': 'text/plain, */*; q=0.01',
										'Accept-Encoding': 'gzip, deflate, br',
										'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6',
										'Connection': 'keep-alive',
										'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
										'Host': 'e.mail.ru',
										'Origin': 'https://e.mail.ru',
										'Referer': 'https://e.mail.ru/',
										'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
										'X-Requested-With': 'XMLHttpRequest'
									}
	
									needle.post(`https://e.mail.ru/api/v1`,obj, options, function(err, resp){
										if ((err == null) && resp.statusCode === 200) {
	
											var threads = resp.body.body.threads
	
											var ln_threads = threads.filter(function(cur){return cur.correspondents.from[0].email == 'security-noreply@linkedin.com'})
	
											if(ln_threads.length !== 0){
	
												var pin = []
	
												var getM = tress(function(query,callback){
													
													needle.post(`https://e.mail.ru/api/v1`,query, options, function(err, resp){
														if ((err == null) && resp.statusCode === 200) {
	
															if(query['__urlp'].indexOf('threads') !== -1){
																var message = resp.body.body.messages[0].body.text.match(/Please use this verification code to complete your sign in: ([0-9]+)/)
															
																if(message !== null){
																	pin.push(message[1])
		
																	if(resp.body.body.messages.length > 1){
																		for(var i=1;i<resp.body.body.messages.length;i++){
																			var obj = {'__urlp':`/messages/message?ajax_call=1&x-email=${bot.email.replace('@','%40')}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date + 20}&email=${bot.email.replace('@','%40')}&htmlencoded=false&multi_msg_prev=0&multi_msg_past=0&sortby=D&NewAttachViewer=1&AvStatusBar=1&let_body_type=let_body_plain&log=0&bulk_show_images=0&folder=0&wrap_body=0&id=${resp.body.body.messages[i].id}&read=${resp.body.body.messages[i].id}&NoMSG=true&mark_read=true&api=1&token=${token.replace(':','%3A')}`}
																			getM.push(obj)
																		}
																	}
		
																	callback()
																} else {
																	callback()
																	return
																}
	
															} else {
																var message = resp.body.body.body.text.match(/Please use this verification code to complete your sign in: ([0-9]+)/) 
															
																if(message !== null){
																	pin.push(message[1])
		
																	callback()
																} else {
																	callback()
																	return
																}
															}
	
	
														} else {
															console.log(`Error: couldn't open message`)
															record(`Error: couldn't open message`,'Error:')
															callback(true)
														}
													})
	
												},5)
	
												getM.drain = function(){
													if(pin.length !== 0){
														resolve(pin)
													} else {
														log_err(`Wrong Message(no pins messages) on Bot #${botdb.indexOf(bot) + 1}!`)
														record(`Wrong Message(no pins messages) on Bot #${botdb.indexOf(bot) + 1}!`,'Error:')
														callback()
														return
													}
												}
												
												getM.retry = function(){
													getM.pause()
														
													setTimeout(function(){
														getM.resume()
													}, 1000)
												}
													
												for(thread of ln_threads){
													var obj = {'__urlp':`/threads/thread?ajax_call=1&x-email=${bot.email.replace('@','%40')}&tarball=e.mail.ru-f-delta-mail-66782-shkinev-1539848907.tgz&tab-time=${date + 20}&email=${bot.email.replace('@','%40')}&offset=0&limit=50&htmlencoded=false&id=${thread.id.replace(/:/g,'%3A')}&api=1&token=${token.replace(':','%3A')}`}
													getM.push(obj)
												}
	
											} else {
												console.log('No messages yet')
												record('No messages yet','Note:')
												setTimeout(getMails,10000)
											}
	
										} else {
											console.log(err)
											record(err,'Error:')
											setTimeout(getMails,10000)
										}
									})
	
								} else {
									console.log(err)
									record(err,'Error:')
									setTimeout(getMails,10000)
								}
							})
	
						} else {
							console.log(err)
							record(err,'Error:')
							setTimeout(getMails,10000)
						}
					})
	
				}
	
				setTimeout(getMails,5000)
	
			})
		}
	
		async function solveCaptcha(){
			return new Promise(async function(resolve,reject){
	
			var options   = new chrome.Options();
			options.addArguments("window-size=1680,1050");
			options.addArguments("disable-web-security");
			options.addArguments("allow-running-insecure-content");
			options.addArguments("headless");
			options.addArguments("--disable-gpu");
			options.addArguments("--log-level=3");
			options.addArguments("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36");
			
			var capabilities = webdriver.Capabilities.chrome()
			capabilities.setPageLoadStrategy('none')
	
			var driver = new webdriver.Builder()
			.forBrowser('chrome')
			.withCapabilities(capabilities)
			.setProxy(proxy.manual({http:`${bot.proxy}:${bot.port}`,https:`${bot.proxy}:${bot.port}`}))
			.setChromeOptions(options)
			.build();
	
			await driver.get('https://www.linkedin.com')
			await domCheck('complete', driver)
	
			try {
				await driver.wait(until.elementLocated(By.id('login-email')),25000)
				await driver.findElement({id:'login-email'}).sendKeys(bot.email)
				await driver.findElement({id:'login-password'}).sendKeys(bot.pass)
				await driver.sleep(1500)
				await driver.findElement({id:'login-submit'}).click()
			} catch(e) {
				await driver.get('https://www.linkedin.com/uas/login?trk=guest_homepage-basic_nav-header-signin')
				await domCheck('complete', driver)
				await driver.wait(until.elementLocated(By.id('username')),25000)
				await driver.findElement({id:'username'}).sendKeys(bot.email)
				await driver.findElement({id:'password'}).sendKeys(bot.pass)
				await driver.sleep(1500)
				await driver.findElement({className:'btn__primary--large from__button--floating'}).click()
			}
	
			await domCheck('complete', driver)
	
			var type_1 = await driver.findElements({id:'challengeContent'})
			var type_2 = await driver.findElements({id:'captcha-challenge'})
			var attempts = 0
	
			if(type_1.length == 0 && type_2.length == 0){
				var ckies = await driver.manage().getCookies()
				await driver.quit()
				resolve(ckies)
				return
			} else {
			//	await driver.sleep(100000000)
				var gkey = ''
				var url = ''
		
				await driver.getCurrentUrl().then(function(lnk){
			
					url = lnk;
					
					getGkey()
					
				})
				
				function getGkey(){
					
					driver.sleep(3000).then(function(){
						driver.findElements({css:'input[type="hidden"]'}).then(function(els){
							els.forEach(function(el){
								el.getAttribute('value').then(function(val){		
									if(val.length == 40){
										gkey = val
									}
								}).catch(function(){
									//
								})
							})
						}).then(function(){
							if(gkey == ''){
								getGkey()
							} else {
								main()
							}
						})
					})
					
				}
		
				function main(){
					var key = '1a21be9ca8506169bd5b2a310457a8d0'
					var code = ''
					var tries = 0;
				
					var requestOptions = {
						url: `http://2captcha.com/in.php?key=${key}&method=userrecaptcha&googlekey=${gkey}&pageurl=${url}`,
						method: 'GET'
					}
						
					request(requestOptions, function (err, resp, body) {
						if ((err == null) && resp.statusCode === 200) {	
							code = body.substring(3,body.length);
							console.log(`Got response from 2captcha - ${body}`)
							record(`Got response from 2captcha - ${body}`,'Info:')
						}
					})
					
					var ans = '';
					
					var chk = setInterval(function(){
							
						var requestOptions = {
						url: `http://2captcha.com/res.php?key=${key}&action=get&id=${code}`,
							method: 'GET'
						}
							
						request(requestOptions, function (err, resp, body) {
							if ((err == null) && resp.statusCode === 200) {			
								tries++;				
								if(body.length > 40){
									console.log('Got captcha answer from 2captcha')
									record('Got captcha answer from 2captcha','Info:')
									ans = body.substring(3,body.length)
									clearInterval(chk)
									goNext(ans).then(function(){},function(){resolve(false)})
								} else {
									console.log(body)
									if(tries == 10){
										console.log('Captcha solving timed out. Sending another request...')
										record('Captcha solving timed out. Sending another request...','Info:')
										clearInterval(chk)
										main();
									}
								}
								
							}
						})
						
					},10000)
				}
		
				async function goNext(ans){
					
					var type_3 = await driver.findElements({id:'challengeContent'})
					var type_4 = await driver.findElements({id:'captcha-challenge'})
					await driver.switchTo().frame(0)
					await driver.wait(until.elementLocated(By.name('g-recaptcha-response')),30000)
					var el = await driver.findElement({name:'g-recaptcha-response'})
					await driver.executeScript("arguments[0].setAttribute('style', 'display:block')",el)
					await el.sendKeys(ans)
					var handles = await driver.getAllWindowHandles()
					await driver.switchTo().window(handles[handles.length - 1])
					await driver.sleep(3000)
					if(type_1.length > 0){
						await driver.executeScript(`window.espanyContainer.contentWindow.grecaptchaData.callback()`)
					} else if(type_2.length > 0){
						var el = await driver.findElement({css:'input[name="captchaUserResponseToken"]'})
						await driver.executeScript(`arguments[0].setAttribute('value','${ans}')`,el)
						await driver.findElement({id:'captcha-challenge'}).submit()
					}
					await driver.sleep(15000)
					type_3 = await driver.findElements({id:'challengeContent'})
					type_4 = await driver.findElements({id:'captcha-challenge'})
			
					if(type_3.length !== 0 || type_4.length !== 0){
						log('Failed captcha, retrying')
						record('Failed captcha, retrying','Error:')
						if(attempts < 5){
							attempts++
							main()
						} else {
							log_err(`Too many attempts to solve captcha for ${bot.email}, skipping`)
							record(`Too many attempts to solve captcha for ${bot.email}, skipping`,'Error:')
							if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
								fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
							}
							skippedBots(botdb.indexOf(bot))
							await driver.quit()
							callback()
						}
					} else {
						log('Passed captcha!')
						record('Passed captcha!','Info:')
						var els = await driver.findElements({id:'error-for-password'})
						var els2 = await driver.findElements({id:'session_password-login-error'})
						var els3 = await driver.findElements({id:'idverifyUrl'})
						var els4 = await driver.findElements({css:'form[name="ATOPinChallengeForm"]'})
						var els5 = await driver.findElements({id:'pagekey-uas-account-restricted'})
						var els6 = await driver.findElements({id:'email-pin-error'})
						if(els.length > 0 || els2.length > 0){
							log_err(`Wrong Password! Skipping - ${bot.email}`)
							record(`Wrong Password! Skipping - ${bot.email}`,'Error:')
							if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
								fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
							}
							skippedBots(botdb.indexOf(bot))
							await driver.quit()
							resolve(false)
						} else {
							if(els3.length > 0 || els5.length > 0){
								log_err(`Account is banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`)
								record(`Account is banned! Skipping - ${bot.email} Bot #${botdb.indexOf(bot) + 1}`,'Error:')
								if (fs.existsSync(`bot${botdb.indexOf(bot) + 1}.lock`)) {
									fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`)
								}
								skippedBots(botdb.indexOf(bot))
								await driver.quit()
								resolve(false)
							} else {
								if(els4.length > 0 || els6.length > 0){
									log_err(`Pin required for account - ${bot.email} - will try to log normally`)
									record(`Pin required for account - ${bot.email} - will try to log normally`,'Error:')
									await driver.quit()
									callback()
									return
								} else {
									var ckies = await driver.manage().getCookies()
									await driver.quit()
									resolve(ckies)
								}
							}	
						}
					}
							
				}
			}
	
		})
	}

	function domCheck(type, driver){
		return new Promise(function(resolve,reject){
			var rscheck = setInterval(function(){
			driver.executeScript("return document.readyState").then(function(rs){
			//	console.log(rs)
				if(type == undefined){
					if(rs == 'interactive' || rs == 'complete'){
						clearInterval(rscheck)
						resolve(rs)
					}
				} else {
					if(type == 'complete'){
						if(rs == 'complete'){
							clearInterval(rscheck)
							resolve(rs)
						}
					}
				}
			})
			},1000)
		})
	}

/* This function is responsible for managing the actions on account after login */

var clients = -1;

function processing(){

	var botNum = botdb.indexOf(bot) + 1
	clients++
	
	if(clients >= clientdb.length){
		record(`No clients left for Bot #${botNum}`,'Info')
		fs.unlink(`bot${botdb.indexOf(bot) + 1}.lock`, () => {})
		callback()
	} else {
		if(botNum >= clientdb[clients][3] && botNum <= clientdb[clients][4]){
			record(`Phase ${phase}, Bot #${botNum}`,'Info')
			toTarget(clientdb[clients],opType).then(function(){},function(){errorHandle('toTarget',toTarget,clientdb[clients],opType)})
		} else {
			processing()
		}
	}

}

/* Sub functions */
var tar_resp, tar_id, tar_ver, followerCount, dataVersion, threadUrn;
async function toTarget(client,type){

if(clientStart !== null){
	if(clientdb.indexOf(client) < clientStart){
		record(`Skipping client #${(clientdb.indexOf(client) + 1)} - Done before`,'Info')
		processing()
		return
	} else {
		clientStart = null
	}
}

var wr = `${phase},${clientdb.indexOf(client)}`

fs.writeFile(`bot${(botdb.indexOf(bot) + 1)}.lock`, wr, {encoding: 'utf-8'} , function (err) {
	if (err) {
		console.log(err);
	// append failed
	}
})

target_max++;

var options_2 = Object.assign({},options)
options_2['headers'] = {
	'method': 'GET',
	'path': `${client[0].replace('https://www.linkedin.com', '')}`,
	...options_2['headers'],
}

try{
	tar_resp = await needle('get', client[0], options_2)
	fs.writeFileSync('ttest.html',tar_resp.body, function(){})
	var $ = cheerio.load(tar_resp.body)
	if (type == 'connect') {
		tar_id = tar_resp.body.match(/urn:li:fs_memberBadges:([a-zA-Z0-9_-]*)&quot;,/)[1]
	}
	else if (type == 'follow') {
		followerCount = tar_resp.body.match(/followerCount&quot;:([0-9]*),&quot/)[1]

		var reg
		if (!client[0].includes('showcase')) {
			dataVersion = tar_resp.body.match(/dataVersion&quot;:([0-9]*),&quot/)[1]
			reg = /f_CC&#61;([0-9]+)&quot/
		} else {
			reg = /urn:li:fs_normalized_showcase:([0-9]+)&quot/
		}

		tar_ver = tar_resp.body.match(reg)[1]
	} else if (type == 'disconnect') {
		tar_ver = tar_resp.body.match(/versionTag&quot;:&quot;([0-9]+)/)[1]
	} else if (type == 'like') {
		if (client[0].includes('/pulse/')) {
			var resp = await needle('get', client[0])
			threadUrn = resp.body.match(/urn:li:article:([0-9]+)/)[0]
		}
		else {
			try {
				threadUrn = tar_resp.body.match(/urn:li:ugcPost:([0-9]+)/)[0]
			} catch(e) {
				try {
					threadUrn = tar_resp.body.match(/urn:li:member:([0-9]+),urn:li:activity:([0-9]+)/)[2]
					threadUrn = 'urn:li:activity:' + threadUrn
				} catch (e) {
					threadUrn = tar_resp.body.match(/urn:li:member:([0-9]+),urn:li:article:([0-9]+)/)[2]
					threadUrn = 'urn:li:article:' + threadUrn
				}
			}
		}
	}
	} catch(err){
		fs.writeFileSync('dettest.html',tar_resp.body,function(){})
		log_err(`In function toTarget for Bot #${botdb.indexOf(bot) + 1}`, err)
		record(`In function toTarget for Bot #${botdb.indexOf(bot) + 1}`, err, 'Error:')
		processing()
		return
	}

var els = $('#nav-typeahead-wormhole')
	if(els.length > 0){
		target_max = 0;
		switch(type) {
			case 'connect':
				setTimeout(function() {
					sub_1(client).then(function(){},function(err){console.log(err);errorHandle('Connect',sub_1,client)})
				}, 3000)
				break;
			case 'disconnect':
				setTimeout(function() {
					sub_2(client).then(function(){},function(){errorHandle('Disconnect',sub_2,client)})
				}, 3000)
				break;
			case 'like':
				setTimeout(function() {
					sub_4(client).then(function(){},function(){errorHandle('Like',sub_4,client)})
				}, 3000)
				break;
			case 'follow':
				setTimeout(function() {
					sub_5(client).then(function(){},function(){errorHandle('Follow',sub_5,client)})
				}, 3000)
				break;
		}
	} else {
		record(`Failed to open profile ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Error')
		if(target_max < 3){
			toTarget(client,type).then(function(){},function(){errorHandle('toTarget',toTarget,client,type)})
		} else {
			record(`Max attempts to open ${client[0]} reached by Bot #${botdb.indexOf(bot) + 1}, skipping`,'Info')
			target_max = 0
			processing()
		}
	}

}

/* CONNECT SUB-FUNCTION */

async function sub_1(client){

	var options_2 = Object.assign({},options)
	options_2['headers'] = {
		'path':  `/voyager/api/growth/normInvitations`,
		"method": "POST",
		"scheme": "https",
		'Accept': '*/*',
		'Accept-Encoding': 'gzip, deflate, br',
		'Accept-Language': 'en-US,en;q=0.9',
		'Content-Type': 'application/json; charset=UTF-8',
		'Csrf-Token': bot.csrf,
		'Referer': client[0],
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36',
		'X-LI-Lang': 'en_US',
		'X-LI-Track': '{"clientVersion":"1.3.1174","osName":"web","timezoneOffset":3,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
		'X-RestLi-Protocol-Version': '2.0.0',
	}
	var url = `https://www.linkedin.com/voyager/api/growth/normInvitations`
	var payload = {
		emberEntityName: "growth/invitation/norm-invitation",
		invitee: {
			'com.linkedin.voyager.growth.invitation.InviteeProfile': {
				profileId: tar_id
			}
		},
		trackingId: "Ux1ZuR1wTPCs0YRH5R0SXg=="
	}

	await needle('post', url, JSON.stringify(payload), options_2)

	record(`Connection request sent to ${client[0]} from Bot #${botdb.indexOf(bot) + 1}`,'Info')
	record(`Processed ${clients + 1} clients with Bot #${botdb.indexOf(bot) + 1}`,'Info')

	processing()
}

/* DISCONNECT SUB-FUNCTION */

async function sub_2(client){

	connect_max ++
	if (connect_max > 3) {
		record(`Couldn't Disconnect with ${client[0]}. Probably already disconnected by Bot #${botdb.indexOf(bot) + 1}, skipping`,'Info')
		errors = 0;
		connect_max = 0;
		processing()
		return
	}
	var options_2 = Object.assign({},options)
	options_2['headers'] = {
		'path': `/voyager/api/identity/profiles${client[0].replace('https://www.linkedin.com/in', '')}profileActions?versionTag=${tar_ver}&action=disconnect`,
		"method": "POST",
		"scheme": "https",
		'Accept': '*/*',
		'Accept-Encoding': 'gzip, deflate, br',
		'Accept-Language': 'en-US,en;q=0.9',
		'Csrf-Token': bot.csrf,
		'Referer': client[0],
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36',
		'X-LI-Lang': 'en_US',
		'X-LI-Track': '{"clientVersion":"1.3.1174","osName":"web","timezoneOffset":3,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
		'X-RestLi-Protocol-Version': '2.0.0',
	}
	var url = `https://www.linkedin.com/voyager/api/identity/profiles${client[0].replace('https://www.linkedin.com/in', '')}profileActions` + 
						`?versionTag=${tar_ver}&action=disconnect`

	var resp = await needle("post", url, {}, options_2)

	if (resp.statusCode === 200) {
		record(`Connection with ${client[0]} was removed for Bot #${botdb.indexOf(bot) + 1}`,'Info')
		erros = 0
		processing()
	} else {
		toTarget(client,'disconnect').then(function(){},function(){errorHandle('toTarget',toTarget,client,'disconnect')})
	}
}

/* LIKE SUB-FUNCTION */

async function sub_4(client){
	
	var options_2 = Object.assign({},options)
	options_2['headers'] = {
		'path': '/voyager/api/feed/reactions',
		"method": "POST",
		"scheme": "https",
		'Accept': '*/*',
		'Accept-Encoding': 'gzip, deflate, br',
		'Accept-Language': 'en-US,en;q=0.9',
		'Content-Type': 'application/json; charset=UTF-8',
		'Csrf-Token': bot.csrf,
		'Referer': client[0],
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36',
		'X-LI-Lang': 'en_US',
		'X-LI-Track': '{"clientVersion":"1.3.1174","osName":"web","timezoneOffset":3,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
		'X-RestLi-Protocol-Version': '2.0.0',
	}
	var url = `https://www.linkedin.com/voyager/api/feed/reactions`
	var payload = {
		reactionType: 'LIKE',
		threadUrn
	}
	var resp = await needle("post", url, JSON.stringify(payload), options_2)

	record(`Liked ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
	processing()
}

/* FOLLOW SUB-FUNCTION */

async function sub_5(client){

	const suburl = client[0].includes('showcase') ? 'showcases' : 'companies'
	var options_2 = Object.assign({},options)
	options_2['headers'] = {
		'path': `/voyager/api/organization/${suburl}/${tar_ver}`,
		"method": "POST",
		"scheme": "https",
		'Accept': '*/*',
		'Accept-Encoding': 'gzip, deflate, br',
		'Accept-Language': 'en-US,en;q=0.9',
		'Content-Type': 'application/json; charset=UTF-8',
		'Csrf-Token': bot.csrf,
		'Referer': client[0],
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36',
		'X-LI-Lang': 'en_US',
		'X-LI-Track': '{"clientVersion":"1.3.1174","osName":"web","timezoneOffset":3,"deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
		'X-RestLi-Protocol-Version': '2.0.0',
	}

	var url = `https://www.linkedin.com/voyager/api/organization/${suburl}/${tar_ver}`
	var payload = client[0].includes('showcase') ? {
		patch: {
			followingInfo: {
				$set: {
					followerCount: parseInt(followerCount) + 1,
					following: true,
				}
			},
			$set: {
			}
		}
	} : {
		patch: {
			followingInfo: {
				$set: {
					following: true,
					followerCount: followerCount + 1
				}
			},
			$set: {
				dataVersion: parseInt(dataVersion)
			}
		}
	}

	var resp = await needle("post", url, JSON.stringify(payload), options_2)
	if (resp.statusCode === 204)
		record(`Followed ${client[0]} by Bot #${botdb.indexOf(bot) + 1}`,'Info')
	else
		record(`Couldn't follow with ${client[0]}. Probably already followed by Bot #${botdb.indexOf(bot) + 1}, skipping`,'Info')
	processing()
}

function errorHandle(name,cb,p1,p2){
	errors++;
	record(`Error with Bot #${botdb.indexOf(bot) + 1} in function ${name}`,'Error')
	
	if(errors < 3){
		cb(p1,p2).then(function(){},function(){errorHandle(name,cb,p1,p2)})
	} else {
		if(called == false){
			called = true;
			setTimeout(function(){
				called = false
			},1000)
			record(`Too many errors on Bot #${botdb.indexOf(bot) + 1}, moving to the next target`,'Error')
			errors = 0
			processing()
		}
	}
}

},number_of_instances)

bots.drain = function(){

if(opType == 'endorse' && phase == 1){
	phase++
	bots.push(botsActive);
} else {
	console.log('All Done')
}
}

phase = 1
clientStart = null

var botsActive = [];
var oldBots = [];
var botStart = 0;

fs.readdirSync(__dirname).forEach(file => {
	if(file.indexOf(".lock") !== -1){
		oldBots.push(parseInt(file.replace('bot','').replace('.lock','')));
	}
})

oldBots.sort(function(a,b){return a-b})

if(oldBots.length > 0){
	botStart = oldBots[oldBots.length - 1]
	phase = parseInt(fs.readFileSync(`bot${oldBots[oldBots.length - 1]}.lock`, 'utf-8').split(',')[0])
	if(fs.readFileSync(`bot${oldBots[oldBots.length - 1]}.lock`, 'utf-8').split(',').length > 1){
		clientStart = parseInt(fs.readFileSync(`bot${oldBots[oldBots.length - 1]}.lock`, 'utf-8').split(',')[1])
	}
}

fs.readdirSync(__dirname).forEach(file => {
	if(file.indexOf(".lock") !== -1){
		fs.unlink(file, function(){})
	}
	if(file == 'log.txt'){
		if (fs.existsSync(`log.txt`)) {
			fs.unlink('log.txt', function(){})
		} else {
			console.log('no')
		}
	}
})

for(i=0;i<oldBots.length;i++){
	botsActive.push(botdb[oldBots[i] - 1])
}

for(i=botStart;i<botdb.length;i++){
	for(var j=0;j<clientdb.length;j++){
		if(i + 1 >= clientdb[j][3] && i + 1 <= clientdb[j][4]){
			botsActive.push(botdb[i])
			break
		}
	}
}

bots.push(botsActive);

function record(message,type){
	
	var data = `${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')} [${type}] ${message}\n`
	console.log(`${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')} [${type}] ${message}`);
	
	fs.appendFile('log.txt','\ufeff' + data, {encoding: 'utf-8'} , function (err) {
		if (err) {
			console.log(err);
		// append failed
		}
	})
	
}

function skippedBots(botNum){
	
	var data = `${botNum + 1}\n`
	
	fs.appendFile('skipped.txt','\ufeff' + data, {encoding: 'utf-8'} , function (err) {
		if (err) {
			//console.log(err);
		// append failed
		}
	})
	
}