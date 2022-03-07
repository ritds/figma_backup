#!/usr/bin/node


// Command line arguments

let figmaLogin = '';
let figmaPassword = '';
let figmaFilesListFile = '';
let downloadsBaseDir = './process/_downloads';
let debugDir = './process/debug';
let figmaUrl = '';
let settingFile = '';

const settings = {
    downloadTimeout: 1800,
    selectorTimeout: 1500,
    navigationTimeout: 180000,
    launchTimeout: 120000,
    loginTimeout: 10000,
    pageOpenTimeout: 10000
}

process.argv.forEach((arg) => {
    const keyValue = arg.split("=");
    switch (keyValue[0]) {
        case 'figmaLogin':
            figmaLogin = keyValue[1];
            break;
        case 'figmaPassword':
            figmaPassword = keyValue[1];
            break;
        case 'figmaFilesList':
            figmaFilesListFile = keyValue[1];
            break;
        case 'downloadsBaseDir':
            downloadsBaseDir = keyValue[1];
            break;
        case 'debugDir':
            debugDir = keyValue[1];
            break;
        case 'figmaUrl':
            figmaUrl = keyValue[1];
            break;
        case 'settingFile': 
            settingFile = keyValue[1];
            break;
    }
})


if(!figmaLogin || !figmaPassword || (!figmaFilesListFile && !figmaUrl))
{
    console.log('Usage: <script_name> <figma_login> <figma_password> <figma_files_list_file> <downloads_base_dir> [<debug_dir>]');
    process.exit(1);
}

const fs = require('fs');
const fse = require('fs-extra')

// Creating the directory for debug purposes

if(debugDir) {
    if(!debugDir.endsWith('/')) {
        debugDir += '/';
    }
    fs.mkdirSync(debugDir, {recursive: true});

    console.log('Working in debug mode; content and screenshots of the file pages will be saved to the directory: ' + debugDir + '\n');
}


// Reading Figma files list file

let figmaFilesList;

if (figmaFilesListFile) {
    fs.readFile(figmaFilesListFile, (err, data) => {
        if(err) throw err;
        figmaFilesList = JSON.parse(data);
    });
}
if (figmaUrl) {
    figmaFilesList = [
        {
            uri: figmaUrl
        }
    ]
}

if (settingFile) {
    let newSettings = {}
    const data = fs.readFileSync(settingFile);
    newSettings = JSON.parse(data);

    settings.downloadTimeout = newSettings.downloadTimeout ?? settings.downloadTimeout;
    settings.selectorTimeout = newSettings.selectorTimeout ?? settings.selectorTimeout;
    settings.navigationTimeout = newSettings.navigationTimeout ?? settings.navigationTimeout;
    settings.launchTimeout = newSettings.launchTimeout ?? settings.launchTimeout;
    settings.loginTimeout = newSettings.loginTimeout ?? settings.loginTimeout;
    settings.pageOpenTimeout = newSettings.pageOpenTimeout ?? settings.pageOpenTimeout;
}

console.log('settings: ', settings);

// Login page settings
const loginPageUrl = 'https://www.figma.com/login';
const usernameSelector = 'input[name="email"]';
const passwordSelector = 'input[name="password"]';
const buttonSelector = 'button[type="submit"]';


// After-login page settings
const filebrowserSelector = '#filebrowser-loading-page';


// File page settings
const filePageBaseUrl = 'https://www.figma.com/file/';
const fullscreenFilenameSelector = '#fullscreen-filename';


// Using Puppeteer

const puppeteer = require('puppeteer');

(async() => {
    // Launching Chrome
    const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox'], timeout: settings.launchTimeout});
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(settings.navigationTimeout);

    try {
        // Opening the login page
        console.log('Opening the login page');
        await page.goto(loginPageUrl, {waitUntil: 'networkidle2'});


        // Filling the email field
        console.log('Filling the email field');
        await page.focus(usernameSelector, {delay: 500});
        await page.keyboard.type(figmaLogin);


        // Filling the password field
        console.log('Filling the password field');
        await page.focus(passwordSelector, {delay: 500});
        await page.keyboard.type(figmaPassword);


        // Clicking the submit button
        console.log('Clicking the submit button');
        await page.click(buttonSelector, {delay: 500});
        console.log('Waiting for an after-login page opening');


        // Sleeping for 10 seconds
        await sleep(settings.loginTimeout);


        // Waiting for an after-login page loading
        await page.waitForSelector(filebrowserSelector);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    if (!downloadsBaseDir.endsWith('/')) {
        downloadsBaseDir += '/'
    }

    let tmpDownloadDir = `${downloadsBaseDir}tmp/`;
    
    for (let t = 1; t < 1000; t++) {
        if (!fs.existsSync(tmpDownloadDir)) {
            break;
        }
        tmpDownloadDir = `${downloadsBaseDir}tmp${t}/`;
    }
    fs.mkdirSync(tmpDownloadDir, {recursive: true});

    console.log(`Tmp directory to save the file: ${tmpDownloadDir}`);

    // Processing Figma files

    for(let i = 0; i < figmaFilesList.length; i++) {
        let filePage = "" 
        if (figmaFilesList[i].uri && figmaFilesList[i].uri.startsWith("http")) {
            filePage = figmaFilesList[i].uri
        } else if (figmaFilesList[i].uri) {
            filePage = filePageBaseUrl + figmaFilesList[i].uri
            if (!filePage.endsWith("/")) {
                filePage += "/" 
            }
        } else {
            filePage = filePageBaseUrl + figmaFilesList[i].key + '/';
        }
        
        console.log('\nStarting to process new file (' + (i + 1) + '/' + figmaFilesList.length + '), url: ' + filePage);

        try {
            // Opening a file page
            console.log('Opening the file page: ' + filePage);
            let filePageResponse = await page.goto(filePage, {waitUntil: 'networkidle2'});


            // Checking status code
            console.log('Returned status: ' + filePageResponse.status());
            if(filePageResponse.status() !== 200) {
                console.log('Skipping the file');
                continue;
            } 
            // Sleeping for 10 seconds, waiting for a specific element in React-generated content
            await sleep(settings.pageOpenTimeout);
            await page.waitForSelector(fullscreenFilenameSelector);

            // Checking if the file is available to save locally

            let content = await page.content();

            if(content.includes('="Viewers can\'t copy or share this file."')) {
                console.log('This file is protected against saving locally and sharing. Skipping')
                continue;
            }
            // Getting and validating page title

            const title = await page.title();
            if(!title.endsWith(' – Figma')) {
                console.log(`Title format "${title}" seems to be unrecognized, skipping the file`)
                await page.screenshot({path: debugDir + 'login_screenshot' + '.png', fullPage: true});
                continue;
            }
            const fileName = title.replace(' – Figma', '').replaceAll('/', '_').replaceAll('|', '_').replaceAll('"', '_');
            // Getting the local path of the directory for the file to download

            let downloadDir = downloadsBaseDir;

            if(!downloadDir.endsWith('/')) {
                downloadDir += '/';
            }

            if(figmaFilesList[i].team) {
                downloadDir += 'TEAM ' + figmaFilesList[i].team + '/';
            }

            if(figmaFilesList[i].project) {
                downloadDir += 'PROJECT ' + figmaFilesList[i].project + '/';
            }
            if (!figmaFilesList[i].team && !figmaFilesList[i].project) {
                downloadDir += fileName + '/';
            }

            

            console.log(`Directory to save the file: ${downloadDir}`);

            fs.mkdirSync(downloadDir, {recursive: true});

            // Set download behavior
            await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: tmpDownloadDir});

            // Debug: making screenshot and saving the page content
            if(debugDir) {
                fs.writeFile(debugDir + (i + 1) + '_content' + '.html', content, () => {});
                await page.screenshot({path: debugDir + (i + 1) + '_screenshot' + '.png', fullPage: true});
            }


            await page.evaluate(_ => {
                const mainMenu = document.querySelector('div[data-tooltip="main-menu"]');
                const clickEvt =  document.createEvent("MouseEvents");
                clickEvt.initEvent("mousedown", true, true); 
                mainMenu.dispatchEvent(clickEvt);
                });
            
            await sleep(200);

            let menuItemFileHandle = null;
            try {
                menuItemFileHandle = await page.waitForSelector('div[data-testid="dropdown-option-File"]', {timeout: settings.selectorTimeout});
            } catch (error) {
                if(debugDir && !menuItemFileHandle) {
                    console.log('cannot open main menu')
                    fs.writeFile(debugDir + fileName + '_main_menu' + '.html', content, () => {});
                    await page.screenshot({path: debugDir + fileName + '_main_menu_screenshot' + '.png', fullPage: true});
                }
                throw error;
            }
    
            const box = await menuItemFileHandle.boundingBox();
            await page.mouse.move(box.x + 5, box.y + 5);

            await sleep(200);
            let submenuFileHandle = null
            try {
                submenuFileHandle = await page.waitForSelector('div[data-testid="dropdown-option-Save local copy…"]', {timeout: settings.selectorTimeout});
            } catch (error) {
                try {
                    const newFileItem = await page.waitForSelector('div[data-testid="dropdown-option-New design file"]', {timeout: settings.selectorTimeout});
                    if (newFileItem) {
                        console.log('cannot save copy export not allowed')
                        continue;
                    }
                } catch (error) {
                    //ignore
                }

                if(debugDir && !submenuFileHandle) {
                    console.log('cannot open file menu')
                    fs.writeFile(debugDir + fileName + '_file_menu' + '.html', content, () => {});
                    await page.screenshot({path: debugDir + fileName + '_file_menu_screenshot' + '.png', fullPage: true});
                }
                throw error;
            }

            
            const saveFileBox = await submenuFileHandle.boundingBox();
            await page.mouse.move(saveFileBox.x + 5, saveFileBox.y + 5);
            await page.mouse.click(saveFileBox.x + 5, saveFileBox.y + 5);

            let downloadedCheckTries = settings.downloadTimeout;

            let downloaded = false;
            for(let j = 0; downloadedCheckTries == 0 || j < downloadedCheckTries; j++) {
                
                await sleep(1000);
                fs.readdir(tmpDownloadDir, (err, files) => {
                    let donwloadedFile = ''
                    if (files && files.length > 0) {
                        donwloadedFile = files[0]
                    }

                    if (donwloadedFile.length) {
                        if (fs.existsSync(downloadDir + donwloadedFile)) {
                            const tmpFileName = donwloadedFile.lastIndexOf('.');
                            const now = new Date().toISOString().substring(0, 19).replaceAll('T', '_').replaceAll(':','-');
                            fse.moveSync(downloadDir + donwloadedFile, downloadDir + donwloadedFile.substring(0, tmpFileName) + '_' + now + donwloadedFile.substring(tmpFileName))
                        }
                        fse.moveSync(tmpDownloadDir + donwloadedFile, downloadDir + donwloadedFile);
                        
                        downloaded = true;
                    }
                });

                if (downloaded) {
                    console.log('Download complete');
                    break;
                }
                
                if (j % 30 == 0) {
                    console.log(`waiting file to download for ${parseInt(j / 60)} min ${j % 60} sec.`)
                }

                if(downloadedCheckTries > 0 && j === (downloadedCheckTries - 1)) {
                    console.log(`File ${title} is not downloaded during timeout`)
                }
            }
        } catch (err) {
            console.error(err);
            continue;
        }
    }
    fs.rmdirSync(tmpDownloadDir);

    // Closing Chromium
    browser.close();
})();


// Sleep function

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}
