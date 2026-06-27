import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import { InventoryPasswordService } from './inventories/inventory-password.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const decryptor = app.get(InventoryPasswordService);

  console.log('--- STARTING GATEWAY DIAGNOSTICS ---');
  
  try {
    const deliveries = await prisma.giaoHang.findMany({
      where: {
        daXoa: false,
      },
      orderBy: { taoLuc: 'desc' },
      take: 20,
    });

    console.log(`Found ${deliveries.length} recent deliveries.`);

    for (const d of deliveries) {
      const meta = d.metadata as any;
      console.log(`\nDelivery ID: ${d.id}`);
      console.log(`Trạng thái: ${d.trangThai}`);
      console.log(`Nguồn giao: ${d.nguonGiaoHang}`);
      console.log(`Nội dung giao: ${d.noiDungGiao}`);
      console.log(`Metadata:`, JSON.stringify(meta, null, 2));

      if (meta && (meta.gatewayToken || meta.encryptedInviteLink)) {
        console.log(`-> Contains Gateway Token: ${meta.gatewayToken}`);
        
        // Test queryRaw
        if (meta.gatewayToken) {
          const rows = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "giao_hang"
            WHERE "da_xoa" = false
              AND "metadata" ->> 'gatewayToken' = ${meta.gatewayToken}
            LIMIT 1
          `;
          console.log(`-> QueryRaw result for token ${meta.gatewayToken}:`, JSON.stringify(rows));
        }

        if (meta.encryptedInviteLink) {
          try {
            const decrypted = decryptor.decrypt(meta.encryptedInviteLink);
            console.log(`-> Decrypted Invite Link: ${decrypted}`);
          } catch (err: any) {
            console.error(`-> DECRYPTION ERROR: ${err.message}`);
          }
        } else {
          console.log(`-> No encryptedInviteLink found in metadata.`);
        }
      }
    }
  } catch (error: any) {
    console.error('Diagnostics error:', error);
  } finally {
    await app.close();
    console.log('--- END GATEWAY DIAGNOSTICS ---');
  }
}

bootstrap();
