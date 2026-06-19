const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // 监听控制台输出
    page.on('console', msg => {
        if (msg.text().includes('[性能]')) {
            console.log('浏览器日志:', msg.text());
        }
    });

    // 监听网络请求
    const requests = [];
    page.on('request', request => {
        if (request.url().includes('geo.datav.aliyun.com')) {
            requests.push({
                url: request.url(),
                startTime: Date.now()
            });
        }
    });

    page.on('response', response => {
        if (response.url().includes('geo.datav.aliyun.com')) {
            const req = requests.find(r => r.url === response.url());
            if (req) {
                req.endTime = Date.now();
                req.duration = req.endTime - req.startTime;
                req.status = response.status();
            }
        }
    });

    try {
        // 加载页面
        console.log('正在加载页面...');
        const filePath = 'file://' + path.resolve(__dirname, 'index.html');
        await page.goto(filePath, { waitUntil: 'networkidle0' });
        console.log('页面加载完成');

        // 注入性能测量代码
        await page.evaluate(() => {
            window.__performanceData = {
                clickTime: null,
                firstResponseTime: null,
                displayTime: null,
                totalTime: null
            };
        });

        // 等待地图瓦片加载
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 点击按钮并测量时间
        console.log('开始测试点击响应时间...');
        console.log('测试城市: 黄州区');
        
        // 记录点击时间
        const clickTime = Date.now();
        console.log(`点击时间: ${clickTime}`);

        // 点击按钮
        await page.click('#commitBtn');

        // 等待结果出现 - 检查多种可能的完成状态
        await page.waitForFunction(() => {
            const result = document.getElementById('result');
            if (!result) return false;
            const html = result.innerHTML;
            // 检查是否包含成功或错误信息
            return html.includes('success-badge') || 
                   html.includes('error-message') || 
                   html.includes('经纬度范围');
        }, { timeout: 60000 });

        const displayTime = Date.now();
        const totalTime = displayTime - clickTime;

        console.log('----------------------------------------');
        console.log('测试结果:');
        console.log('----------------------------------------');
        console.log(`点击到区域显示总时间: ${totalTime}ms`);
        console.log('----------------------------------------');

        // 获取网络请求详情
        console.log('\n网络请求详情:');
        requests.forEach((req, index) => {
            if (req.duration) {
                console.log(`请求 ${index + 1}: ${req.duration}ms - ${req.url.split('/').pop()}`);
            }
        });

        // 计算总网络时间
        const totalNetworkTime = requests.reduce((sum, req) => sum + (req.duration || 0), 0);
        console.log(`\n总网络请求时间: ${totalNetworkTime}ms`);

        // 获取最终结果
        const resultText = await page.evaluate(() => {
            return document.getElementById('result').innerHTML;
        });
        console.log('\n最终显示结果:');
        console.log(resultText.replace(/<br\/>/g, '\n'));

    } catch (error) {
        console.error('测试失败:', error.message);
    } finally {
        await browser.close();
    }
})();
