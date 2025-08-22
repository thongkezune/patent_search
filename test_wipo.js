const axios = require('axios');

async function testWIPOSearch() {
    try {
        console.log('🚀 Starting WIPO Advanced Search test...');
        console.log('⏱️  Timeout set to 5 minutes');
        
        const searchParams = {
            keywords: 'EN_TI=(solar panel) AND EN_AB=(efficiency)',
            source: 'wipo',
            maxResults: 5,
            debug: true  // Add debug flag to get more detailed logs from server
        };

        console.log('📝 Search parameters:', JSON.stringify(searchParams, null, 2));
        
        // Create axios instance with longer timeout and progress tracking
        const instance = axios.create({
            timeout: 300000, // 5 minutes
            baseURL: 'http://localhost:3000'
        });

        // Add request interceptor for timing
        instance.interceptors.request.use(request => {
            request.metadata = { startTime: new Date() };
            return request;
        });

        // Add response interceptor for timing
        instance.interceptors.response.use(response => {
            const duration = new Date() - response.config.metadata.startTime;
            console.log(`⏱️  Request completed in ${duration/1000} seconds`);
            return response;
        });

        console.log('🔍 Sending search request to server...');
        const response = await instance.post('/api/search', searchParams);

        if (response.data.patents && response.data.patents.length > 0) {
            console.log('\n✅ Found', response.data.patents.length, 'patents:');
            response.data.patents.forEach((patent, index) => {
                console.log(`\n📄 Patent ${index + 1}:`);
                console.log(`   Title: ${patent.title}`);
                console.log(`   ID: ${patent.id}`);
                console.log(`   Date: ${patent.date}`);
                console.log(`   Applicant: ${patent.applicant}`);
            });
        } else {
            console.log('❌ No patents found');
        }

    } catch (error) {
        console.error('\n❌ Error occurred:');
        if (error.code === 'ECONNABORTED') {
            console.error('   Request timed out after 5 minutes');
        } else if (error.response?.data) {
            console.error('   Server error:', error.response.data);
        } else {
            console.error('   Error:', error.message);
        }
        
        // Print additional error details if available
        if (error.response?.status) {
            console.error('   Status:', error.response.status);
        }
        if (error.config?.metadata) {
            const duration = new Date() - error.config.metadata.startTime;
            console.error(`   Request duration before failure: ${duration/1000} seconds`);
        }
    }
}

console.log('🔧 Test script started');
testWIPOSearch();