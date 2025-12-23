const fs = require("fs");
const path = require("path");

const dirPath = path.join(__dirname, "database/migrations/sqlite");

if (!fs.existsSync(dirPath)) {
  console.error("Directory not found:", dirPath);
  process.exit(1);
}

fs.readdirSync(dirPath).forEach((file) => {
  const filePath = path.join(dirPath, file);
  const content = fs.readFileSync(filePath, "utf8");

  console.log("=================================");
  console.log("FILE:", file);
  console.log("CONTENT:");
  console.log(content);
});
