import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('DemoPassword123!', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@taxbridge.ng' },
    update: {},
    create: {
      email: 'demo@taxbridge.ng',
      password: hashedPassword,
      name: 'Demo User',
      phone: '+2348012345678',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('✅ Created demo user:', user.email);

  // Create demo business
  const business = await prisma.business.upsert({
    where: { tin: '12345678-0001' },
    update: {},
    create: {
      name: 'Acme Trading Limited',
      cacNumber: 'RC123456',
      tin: '12345678-0001',
      bvn: '12345678901',
      email: 'info@acmetrading.ng',
      phone: '+2348087654321',
      address: {
        street: '123 Main Street',
        city: 'Lagos',
        state: 'Lagos',
        zipCode: '100001',
        country: 'Nigeria'
      },
      businessType: 'limited-company',
      status: 'VERIFIED',
      ownerId: user.id,
      tinVerified: true,
      bvnVerified: true,
      cacVerified: true,
      verifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('✅ Created demo business:', business.name);

  // Create demo employees
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        businessId: business.id,
        name: 'John Doe',
        email: 'john.doe@acmetrading.ng',
        phone: '+2348011112222',
        grossSalary: 500000,
        allowances: {
          housing: 100000,
          transport: 50000,
          meal: 30000,
          others: 20000
        },
        taxReliefs: {
          cra: 200000,
          pension: 40000,
          nhf: 12500
        },
        startDate: new Date('2026-01-01'),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.employee.create({
      data: {
        businessId: business.id,
        name: 'Jane Smith',
        email: 'jane.smith@acmetrading.ng',
        phone: '+2348022223333',
        grossSalary: 750000,
        allowances: {
          housing: 150000,
          transport: 75000,
          meal: 40000,
          others: 30000
        },
        taxReliefs: {
          cra: 200000,
          pension: 60000,
          nhf: 18750
        },
        startDate: new Date('2026-01-01'),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  ]);

  console.log('✅ Created demo employees:', employees.length);

  // Create demo invoices
  const invoices = await Promise.all([
    prisma.invoice.create({
      data: {
        invoiceNumber: 'INV/2026/00001',
        businessId: business.id,
        customer: {
          name: 'ABC Corporation',
          email: 'accounts@abc.com',
          phone: '+2348087654321',
          tin: '87654321-0001',
          address: '456 Business Ave, Abuja'
        },
        items: [
          {
            description: 'Web Development Services',
            quantity: 1,
            unitPrice: 500000,
            vatApplicable: true,
            total: 500000,
            vatAmount: 37500
          },
          {
            description: 'Hosting (Annual)',
            quantity: 1,
            unitPrice: 50000,
            vatApplicable: true,
            total: 50000,
            vatAmount: 3750
          }
        ],
        subtotal: 550000,
        vatAmount: 41250,
        total: 591250,
        dueDate: new Date('2026-03-15'),
        status: 'SENT',
        nrsCompliant: true,
        firsIRN: 'NRS-2026-DEMO-001',
        firsCSID: 'CSID-DEMO-001',
        template: 'professional',
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.invoice.create({
      data: {
        invoiceNumber: 'INV/2026/00002',
        businessId: business.id,
        customer: {
          name: 'XYZ Limited',
          email: 'finance@xyz.com',
          phone: '+2348098765432',
          tin: '98765432-0001',
          address: '789 Commerce Road, Port Harcourt'
        },
        items: [
          {
            description: 'Consulting Services',
            quantity: 10,
            unitPrice: 100000,
            vatApplicable: true,
            total: 1000000,
            vatAmount: 75000
          }
        ],
        subtotal: 1000000,
        vatAmount: 75000,
        total: 1075000,
        dueDate: new Date('2026-04-01'),
        status: 'PAID',
        nrsCompliant: true,
        firsIRN: 'NRS-2026-DEMO-002',
        firsCSID: 'CSID-DEMO-002',
        template: 'service',
        sentAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  ]);

  console.log('✅ Created demo invoices:', invoices.length);

  // Create demo payment for second invoice
  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoices[1].id,
      businessId: business.id,
      amount: 1075000,
      paymentMethod: 'card',
      gateway: 'paystack',
      reference: 'TB-DEMO-' + Date.now(),
      status: 'SUCCESS',
      paidAt: new Date(),
      metadata: {
        channel: 'card',
        cardType: 'visa',
        last4: '4081'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  console.log('✅ Created demo payment:', payment.reference);

  // Create demo expenses
  const expenses = await Promise.all([
    prisma.expense.create({
      data: {
        businessId: business.id,
        amount: 50000,
        category: 'office-supplies',
        description: 'Office stationery and supplies',
        date: new Date('2026-02-05'),
        vatAmount: 3750,
        vatEligible: true,
        status: 'approved',
        approvedBy: user.id,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.expense.create({
      data: {
        businessId: business.id,
        amount: 150000,
        category: 'utilities',
        description: 'Electricity and internet bills',
        date: new Date('2026-02-01'),
        vatAmount: 11250,
        vatEligible: true,
        status: 'approved',
        approvedBy: user.id,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.expense.create({
      data: {
        businessId: business.id,
        amount: 75000,
        category: 'fuel',
        description: 'Fuel for company vehicles',
        date: new Date('2026-02-08'),
        vatAmount: 5625,
        vatEligible: true,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  ]);

  console.log('✅ Created demo expenses:', expenses.length);

  // Create demo compliance reminders
  const reminders = await Promise.all([
    prisma.complianceReminder.create({
      data: {
        businessId: business.id,
        taxType: 'VAT',
        dueDate: new Date('2026-03-21'),
        amount: 41250,
        status: 'pending',
        priority: 'high',
        description: 'VAT Return for February 2026',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.complianceReminder.create({
      data: {
        businessId: business.id,
        taxType: 'PAYE',
        dueDate: new Date('2026-03-10'),
        amount: 125000,
        status: 'pending',
        priority: 'high',
        description: 'PAYE Remittance for February 2026',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.complianceReminder.create({
      data: {
        businessId: business.id,
        taxType: 'CIT',
        dueDate: new Date('2026-06-30'),
        status: 'pending',
        priority: 'medium',
        description: 'Company Income Tax Return for 2025',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  ]);

  console.log('✅ Created compliance reminders:', reminders.length);

  // Create demo crypto transactions
  const cryptoTransactions = await Promise.all([
    prisma.cryptoTransaction.create({
      data: {
        businessId: business.id,
        type: 'buy',
        asset: 'BTC',
        amount: 0.01,
        priceNGN: 50000000,
        totalNGN: 500000,
        costBasis: 500000,
        platform: 'Binance',
        date: new Date('2026-01-15'),
        taxYear: 2026,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.cryptoTransaction.create({
      data: {
        businessId: business.id,
        type: 'sell',
        asset: 'BTC',
        amount: 0.005,
        priceNGN: 55000000,
        totalNGN: 275000,
        costBasis: 250000,
        platform: 'Binance',
        date: new Date('2026-02-01'),
        taxYear: 2026,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  ]);

  console.log('✅ Created crypto transactions:', cryptoTransactions.length);

  console.log('\n🎉 Database seed completed successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('   Email: demo@taxbridge.ng');
  console.log('   Password: DemoPassword123!');
  console.log('\n📊 Seeded Data:');
  console.log('   - 1 User');
  console.log('   - 1 Business (Verified)');
  console.log('   - 2 Employees');
  console.log('   - 2 Invoices (1 Sent, 1 Paid)');
  console.log('   - 1 Payment');
  console.log('   - 3 Expenses (2 Approved, 1 Pending)');
  console.log('   - 3 Compliance Reminders');
  console.log('   - 2 Crypto Transactions');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
