const knex = require('knex');
const knexfile = require('./knexfile');
const db = knex(knexfile.development);

async function test() {
  try {
    const from = '2026-05-30 00:00:00';
    const to = '2026-05-30 23:59:59';

    // INCOME
    let orderPaymentsQuery = db('payments')
      .join('orders', 'payments.order_id', 'orders.id')
      .select(
        'payments.created_at',
        db.raw("'income' as type"),
        db.raw("'order_payment' as category"),
        db.raw("CONCAT('Order #', orders.id) as description"),
        'payments.amount as amount_in',
        db.raw('0 as amount_out'),
        'payments.method as payment_method'
      );

    let packagePaymentsQuery = db('package_payments')
      .join('packages', 'package_payments.package_id', 'packages.id')
      .select(
        'package_payments.created_at',
        db.raw("'income' as type"),
        db.raw("'package_payment' as category"),
        db.raw("CONCAT('Package: ', packages.customer_name) as description"),
        'package_payments.amount as amount_in',
        db.raw('0 as amount_out'),
        'package_payments.payment_method'
      );

    // EXPENSES
    let vendorPurchasesQuery = db('vendor_ledgers')
      .join('vendors', 'vendor_ledgers.vendor_id', 'vendors.id')
      .where('vendor_ledgers.transaction_type', 'purchase')
      .select(
        'vendor_ledgers.created_at',
        db.raw("'expense' as type"),
        db.raw("'vendor_purchase' as category"),
        db.raw("CONCAT('Purchase from ', vendors.name) as description"),
        db.raw('0 as amount_in'),
        'vendor_ledgers.amount as amount_out',
        db.raw("'cash' as payment_method")
      );
      
    let vendorPaymentsQuery = db('vendor_ledgers')
      .join('vendors', 'vendor_ledgers.vendor_id', 'vendors.id')
      .where('vendor_ledgers.transaction_type', 'payment')
      .select(
        'vendor_ledgers.created_at',
        db.raw("'expense' as type"),
        db.raw("'vendor_payment' as category"),
        db.raw("CONCAT('Payment to ', vendors.name) as description"),
        db.raw('0 as amount_in'),
        'vendor_ledgers.amount as amount_out',
        db.raw("'cash' as payment_method")
      );

    let hrQuery = db('employee_payments')
      .join('employees', 'employee_payments.employee_id', 'employees.id')
      .select(
        'employee_payments.created_at',
        db.raw("'expense' as type"),
        db.raw("'salary' as category"),
        db.raw("CONCAT('Salary: ', employees.name) as description"),
        db.raw('0 as amount_in'),
        'employee_payments.amount as amount_out',
        'employee_payments.payment_method'
      );

    let maintenanceQuery = db('maintenance_logs')
      .whereNotNull('repair_cost')
      .select(
        'created_at',
        db.raw("'expense' as type"),
        db.raw("'maintenance' as category"),
        db.raw("CONCAT('Maintenance: ', item_name) as description"),
        db.raw('0 as amount_in'),
        'repair_cost as amount_out',
        db.raw("'cash' as payment_method")
      );

    let customQuery = db('expense_logs')
      .select(
        'created_at',
        db.raw("'expense' as type"),
        'category',
        'description',
        db.raw('0 as amount_in'),
        'amount as amount_out',
        'payment_method'
      );

    console.log('Testing queries...');
    await orderPaymentsQuery.limit(1); console.log('1 ok');
    await packagePaymentsQuery.limit(1); console.log('2 ok');
    await vendorPurchasesQuery.limit(1); console.log('3 ok');
    await vendorPaymentsQuery.limit(1); console.log('4 ok');
    await hrQuery.limit(1); console.log('5 ok');
    await maintenanceQuery.limit(1); console.log('6 ok');
    await customQuery.limit(1); console.log('7 ok');
    
    console.log('All queries passed!');
  } catch(e) {
    console.error('FAILED', e);
  } finally {
    db.destroy();
  }
}
test();
