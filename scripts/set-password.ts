import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma";

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
	console.error("Usage: npx tsx scripts/set-password.ts <email> <password>");
	console.error(
		"Example: npx tsx scripts/set-password.ts user@example.com MyPassword123",
	);
	process.exit(1);
}

const adapter = new PrismaBetterSqlite3({
	url: process.env.DATABASE_URL ?? "file:./prisma/ralph.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		console.error(`User with email "${email}" not found`);
		process.exit(1);
	}

	const passwordHash = await bcrypt.hash(password, 12);

	await prisma.user.update({
		where: { email },
		data: { passwordHash },
	});

	console.log(`Password set successfully for ${email}`);
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
