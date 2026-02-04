
const mysql = require('mysql2/promise');

async function test() {
    console.log("Testing 3306...");
    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1',
            port: 3306,
            user: 'ai_user',
            password: 'X.]PGr5gnY]oKoXC',
            database: 'DEV_asset_manager'
        });
        console.log("SUCCESS on 3306");
        await connection.end();
    } catch (err) {
        console.error("FAILED on 3306:", err.message);
    }

    console.log("\nTesting 3307...");
    try {
        const connection = await mysql.createConnection({
            host: '127.0.0.1',
            port: 3307,
            user: 'ai_user',
            password: 'X.]PGr5gnY]oKoXC',
            database: 'DEV_asset_manager'
        });
        console.log("SUCCESS on 3307");
        await connection.end();
    } catch (err) {
        console.error("FAILED on 3307:", err.message);
    }
}

test();
