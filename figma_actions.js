
const loginPageUrl = 'https://www.figma.com/login';
const filePageBaseUrl = 'https://www.figma.com/file/';
const usernameSelector = 'input[name="email"]';
const passwordSelector = 'input[name="password"]';
const buttonSelector = 'button[type="submit"]';
const filebrowserSelector = '#filebrowser-loading-page';

const puppeteer = require('puppeteer');
const fs = require('fs');
const fse = require('fs-extra');
const {sleep} = require('./utils');
const log4js = require('log4js');

const logger = log4js.getLogger();
logger.level = "info";
log4js.configure({
    appenders: {
      out: { type: 'stdout', layout: {
        type: 'pattern',
        pattern: '%d{yyyy-MM-dd hh:mm:ss} %m'
      }}
    },
    categories: { default: { appenders: ['out'], level: 'info' } }
  });

function readSettings() {
    const settings = {
        downloadTimeout: 360,
        selectorTimeout: 5000,
        navigationTimeout: 180000,
        launchTimeout: 120000,
        loginTimeout: 10000,
        pageOpenTimeout: 10000,
        pageLoadTimeout: 60000,
        downloadsBaseDir: './process/_downloads',
        debugDir: './process/debug/',
        doDebug: false,
        saveScreenOnError: true
    }
    
    if (fs.existsSync('./config/download_settings.json')) {
        const data = fs.readFileSync('./config/download_settings.json');
        newSettings = JSON.parse(data);

        settings.downloadTimeout = newSettings.downloadTimeout ?? settings.downloadTimeout;
        settings.selectorTimeout = newSettings.selectorTimeout ?? settings.selectorTimeout;
        settings.navigationTimeout = newSettings.navigationTimeout ?? settings.navigationTimeout;
        settings.launchTimeout = newSettings.launchTimeout ?? settings.launchTimeout;
        settings.loginTimeout = newSettings.loginTimeout ?? settings.loginTimeout;
        settings.pageOpenTimeout = newSettings.pageOpenTimeout ?? settings.pageOpenTimeout;
        settings.doDebug = newSettings.doDebug ?? settings.doDebug;
        settings.saveScreenOnError = newSettings.saveScreenOnError ?? settings.saveScreenOnError;
        settings.pageLoadTimeout = newSettings.pageLoadTimeout ?? settings.pageLoadTimeout;
    }

    return settings;
}

async function open(settings) {
    const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage '], timeout: settings.launchTimeout, headless: true});
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(settings.navigationTimeout);
    
    return {browser, page}
}

async function login(session, settings) {
    try {
        // Opening the login page
        logger.info('Opening the login page');
        await session.page.goto(loginPageUrl, {waitUntil: 'networkidle2'});


        // Filling the email field
        logger.info('Filling the email field');
        await session.page.focus(usernameSelector, {delay: 500});
        await session.page.keyboard.type(session.figmaLogin);


        // Filling the password field
        logger.info('Filling the password field');
        await session.page.focus(passwordSelector, {delay: 500});
        await session.page.keyboard.type(session.figmaPassword);


        // Clicking the submit button
        logger.info('Clicking the submit button');
        await session.page.click(buttonSelector, {delay: 500});
        logger.info('Waiting for an after-login page opening');


        // Sleeping for 10 seconds
        await sleep(settings.loginTimeout);

        // Waiting for an after-login page loading
        await session.page.waitForSelector(filebrowserSelector);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

const HTTP_NOT_200 = -1;
const SAVE_NOT_ALLOWED = -2;
const BAD_FILE_FORMAT = -3;
const CANNOT_OPEN_MAIN_MENU = -4;
const CANNOT_OPEN_FILE_MENU = -5;
const DOWNLOAD_FAILED = -6;
const UNKNOWN_ERROR = -7;

async function downloadFile(session, file, settings) {
    let debugDir = settings.debugDir;
    let page = session.page;

    let filePage = "" 
    if (file.uri && file.uri.startsWith("http")) {
        filePage = file.uri
    } else if (file.uri) {
        filePage = filePageBaseUrl + file.uri
        if (!filePage.endsWith("/")) {
            filePage += "/" 
        }
    } else {
        filePage = filePageBaseUrl + file.key + '/';
    }    
    logger.info('Starting to process file, url: ' + filePage);

    try {
        // Opening a file page
        let filePageResponse = await page.goto(filePage, {waitUntil: 'networkidle2'});
        // Checking status code
        if(filePageResponse.status() !== 200) {
            logger.info(`Skipping the file, status = ${filePageResponse.status()}`);
            return HTTP_NOT_200;
        } 
        // Sleeping for 10 seconds, waiting for a specific element in React-generated content
        await sleep(settings.pageOpenTimeout);
        await page.waitForSelector('[data-testid="set-tool-default"]', {timeout: settings.pageLoadTimeout});
        // Checking if the file is available to save locally
        let content = await page.content();

        if(content.includes('="Viewers can\'t copy or share this file."')) {
            logger.info('This file is protected against saving locally and sharing. Skipping')
            return SAVE_NOT_ALLOWED;
        }
        // Getting and validating page title
        const title = await page.title();
        const fileName = title.replace(' – Figma', '').replaceAll('/', '_').replaceAll('|', '_').replaceAll('"', '_');
        if(!title.endsWith(' – Figma')) {
            logger.info(`Title format "${title}" seems to be unrecognized, skipping the file`)
            if (settings.debugDir && (settings.saveScreenOnError || settings.doDebug)) {
                await page.screenshot({path: debugDir + fileName +'_screenshot.png', fullPage: true});
            }
            return BAD_FILE_FORMAT;
        }
        // Getting the local path of the directory for the file to download
        let downloadDir = file.path;

        if(!downloadDir.endsWith('/')) {
            downloadDir += '/';
        }
        let downloadsBaseDir = settings.downloadsBaseDir;
        let tmpDownloadDir = `${downloadsBaseDir}/tmp/`;
    
        for (let t = 1; t < 1000; t++) {
            if (!fs.existsSync(tmpDownloadDir)) {
                break;
            }
            tmpDownloadDir = `${downloadsBaseDir}/tmp${t}/`;
        }
        fs.mkdirSync(tmpDownloadDir, {recursive: true});
    
        logger.info(`Tmp directory to save the file: ${tmpDownloadDir}`);
    
        fs.mkdirSync(downloadDir, {recursive: true});

        // Set download behavior
        await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: tmpDownloadDir});

        // Debug: making screenshot and saving the page content
        if(settings.debugDir && settings.doDebug) {
            fs.writeFile(debugDir + title + '_content' + '.html', content, () => {});
            await page.screenshot({path: debugDir + fileName + '_screenshot' + '.png', fullPage: true});
        }


        await page.evaluate(_ => {
            const mainMenu = document.querySelector('div[data-tooltip="main-menu"]');
            const clickEvt =  document.createEvent("MouseEvents");
            clickEvt.initEvent("mousedown", true, true); 
            mainMenu.dispatchEvent(clickEvt);
            });
        
        await sleep(500);

        let menuItemFileHandle = null;
        let box = {x: 8, y: 143};
        try {
            menuItemFileHandle = await page.waitForSelector('div[data-testid="dropdown-option-File"]', {timeout: settings.selectorTimeout});
            box = await menuItemFileHandle.boundingBox();
        } catch (error) {
            logger.info('cannot open main menu\n', error);
            if(debugDir && !menuItemFileHandle && (settings.doDebug || settings.saveScreenOnError)) {
                fs.writeFile(debugDir + fileName + '_main_menu.html', content, () => {});
                await page.screenshot({path: debugDir + fileName + '_main_menu_screenshot.png', fullPage: true});
            }
            return CANNOT_OPEN_MAIN_MENU;
        }

        await page.mouse.move(box.x + 5, box.y + 5);
        await sleep(500);

        let submenuFileHandle = null
        let saveFileBox = {x: 0, y: 0};
        try {
            submenuFileHandle = await page.waitForSelector('div[data-testid="dropdown-option-Save local copy…"]', {timeout: settings.selectorTimeout});
            saveFileBox = await submenuFileHandle.boundingBox();
        } catch (error) {
            if (debugDir && !submenuFileHandle && (settings.doDebug || settings.saveScreenOnError)) {
                fs.writeFile(debugDir + fileName + '_file_menu' + '.html', content, () => {});
                await page.screenshot({path: debugDir + fileName + '_file_menu_screenshot' + '.png', fullPage: true});
            }
        }
        
        // const saveFileBox = await submenuFileHandle.boundingBox();
        if (!saveFileBox.x || !saveFileBox.y) {
            try {
                const newFileItem = await page.waitForSelector('div[data-testid="dropdown-option-New design file"]', {timeout: settings.selectorTimeout});
                if (newFileItem) {
                    logger.info('cannot save copy export not allowed')
                    return SAVE_NOT_ALLOWED;
                }
            } catch (error) {
                //ignore
            }
            logger.info('cannot select Save local copy… menu item');
            return CANNOT_OPEN_FILE_MENU;
        }

        await page.mouse.move(saveFileBox.x + 5, saveFileBox.y + 5);
        await page.mouse.click(saveFileBox.x + 5, saveFileBox.y + 5);

        let downloadedCheckTries = settings.downloadTimeout;

        let downloaded = false;
        let downloadError = false;

        for(let j = 0; downloadedCheckTries == 0 || j < downloadedCheckTries; j++) {
            await sleep(1000);
            fs.readdir(tmpDownloadDir, (err, files) => {
                try {
                    let donwloadedFile = ''
                    if (files && files.length > 0 && (files[0].toLowerCase().endsWith(".jam") || files[0].toLowerCase().endsWith(".fig"))) {
                        donwloadedFile = files[0]
                    }


                    if (donwloadedFile.length) {
                        if (fs.existsSync(downloadDir + donwloadedFile)) {
                            const tmpFileName = donwloadedFile.lastIndexOf('.');
                            const now = new Date().toISOString().substring(0, 19).replaceAll('T', '_').replaceAll(':','-');
                            fse.moveSync(downloadDir + donwloadedFile, downloadDir + donwloadedFile.substring(0, tmpFileName) + '_' + now + donwloadedFile.substring(tmpFileName))
                        }
                        fse.moveSync(tmpDownloadDir + donwloadedFile, downloadDir + donwloadedFile);
                        
                        if (file.key) {
                            if (!fs.existsSync(downloadDir + 'map/')) {
                                fs.mkdirSync(downloadDir + 'map/', {recursive: true});
                            }
                            if (file.key) {
                                if (fs.existsSync(downloadDir + 'map/' + file.key)) {
                                    fs.rmSync(downloadDir + 'map/' + file.key);
                                }
                                fs.writeFileSync(downloadDir + 'map/' + file.key, donwloadedFile)
                            }
                        }
                        
                        downloaded = true;
                    }
                } catch (error) {
                    logger.info(`cannot define file ${title} download`, error);
                    downloadError = true;
                }
            });

            if (downloadError) {
                logger.info(`Download ${title} failed`);
                return DOWNLOAD_FAILED;
            }

            if (downloaded) {
                logger.info('Download complete');
                break;
            }
            
            if (j % 30 == 0) {
                logger.info(`waiting file to download for ${parseInt(j / 60)} min ${j % 60} sec.`)
            }

            if(downloadedCheckTries > 0 && j === (downloadedCheckTries - 1)) {
                logger.info(`File ${title} is not downloaded during timeout`)
            }
        }
    
    } catch (err) {
        console.error(err);
        return UNKNOWN_ERROR;
    }
    
    try {
        if (fs.existsSync(tmpDownloadDir)) {
            fs.rmdirSync(tmpDownloadDir);
        }
    } catch (err) {
        
    }

    return 0;
}

function close(session) {
    session.browser.close();
}

module.exports = {readSettings, open, login, downloadFile, close}