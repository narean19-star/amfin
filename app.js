/**
 * AM Sales Pro v10 - Accounting Application
 * Fully cloud-based with offline-first architecture
 * Auto-syncs to Supabase with intelligent retry
 */
function accountingApp() {
    return {
        // ─── State ─────────────────────────────────────────────────
        view: 'dashboard',
        isLoading: true,
        isSaving: false,
        loadingMsg: '',
        progress: 0,
        sidebarOpen: false,
        toasts: [],
        showInstallPrompt: false,
        notifications: [],
        showNotificationCenter: false,
        unreadNotificationCount: 0,
        modal: { show: false, title: '', message: '', onConfirm: null, onCancel: null },
        syncQueue: [],
        lastSyncTime: null,

        // Global filters
        filterFrom: '',
        filterTo: '',

        // Data stores
        entries: [],
        purchases: [],
        expenses: [],
        cheques: [],

        // Master lists
        owners: [],
        customers: [],
        items: [],
        suppliers: [],
        expenseCategories: [
            'Rent', 'Salaries', 'Fuel & Transport', 'Electricity',
            'Telephone', 'Maintenance', 'Stationery', 'Miscellaneous'
        ],
        expenseCategoryKeywords: {
            'Fuel & Transport': ['fuel', 'petrol', 'diesel', 'transport', 'travel', 'bus', 'train', 'flight', 'taxi', 'uber'],
            'Salaries': ['salary', 'payroll', 'wages'],
            'Rent': ['rent', 'lease', 'office space'],
            'Electricity': ['electricity', 'power bill'],
            'Telephone': ['telephone', 'internet', 'mobile', 'phone bill', 'data'],
            'Maintenance': ['maintenance', 'repair', 'service', 'amc'],
            'Stationery': ['stationery', 'pen', 'paper', 'print', 'office supplies'],
            'Miscellaneous': ['misc', 'sundry']
        },

        // Cloud status
        cloudAvailable: false,
        cloudStatus: 'Checking...',
        cloudStorage: 'local',
        cloudStorageDetails: '',
        apiBase: 'Supabase',

        // Search & filters
        searchRecords: '',
        searchOwner: '',
        searchCustomer: '',
        searchPurchases: '',
        searchOutstanding: '',
        searchExpenses: '',
        billSearch: '',
        foundBill: null,
        recordsTab: 'all',
        chequeTab: 'all',
        debtorsTab: 'debtors',

        // Forms
        saleForm: {},
        purchaseForm: {},
        expenseForm: {},
        chequeForm: {},

        // Analysis filters
        analysisOwner: '',
        analysisCustomer: '',

        // Master inputs
        newOwnerInput: '',
        newCustInput: '',
        newItemInput: '',
        newCatInput: '',
        newSupplierInput: '',
        newOwnerMode: false,
        newCustMode: false,
        newItemMode: false,

        // AI Assistant
        aiPrompt: '',
        aiInsight: '',
        isAILoading: false,

        // Internal
        _charts: {},
        _persistTimer: null,
        _chartInitialized: false,

        // ─── Computed ─────────────────────────────────────────────
        get viewTitle() {
            const titles = {
                dashboard: 'Dashboard', records: 'Sales Ledger', entry: 'Sale Entry',
                purchases: 'Purchases', cheques: 'Cheque Registry', cashflow: 'Expenses & Cashflow',
                analysis: 'P&L Analysis', debtors: 'Debtors & Creditors',
                financials: 'Financial Reports', master: 'Master Data'
            };
            return titles[this.view] || 'AM Sales Pro v10';
        },

        get dateFilteredEntries() {
            const { filterFrom, filterTo } = this;
            if (!filterFrom && !filterTo) return this.entries;
            return this.entries.filter(e => {
                const date = new Date(e.Date);
                const from = filterFrom ? new Date(filterFrom) : null;
                const to = filterTo ? new Date(filterTo) : null;
                return (!from || date >= from) && (!to || date <= to);
            });
        },
        get dateFilteredPurchases() {
            const { filterFrom, filterTo } = this;
            if (!filterFrom && !filterTo) return this.purchases;
            return this.purchases.filter(p => {
                const date = new Date(p.date);
                const from = filterFrom ? new Date(filterFrom) : null;
                const to = filterTo ? new Date(filterTo) : null;
                return (!from || date >= from) && (!to || date <= to);
            });
        },
        get dateFilteredExpenses() {
            const { filterFrom, filterTo } = this;
            if (!filterFrom && !filterTo) return this.expenses;
            return this.expenses.filter(e => {
                const date = new Date(e.date);
                const from = filterFrom ? new Date(filterFrom) : null;
                const to = filterTo ? new Date(filterTo) : null;
                return (!from || date >= from) && (!to || date <= to);
            });
        },

        get totals() {
            const sales = this.dateFilteredEntries.reduce((s, e) => s + (e['C.Amount'] || 0), 0);
            const purchasesTotal = this.dateFilteredPurchases.reduce((s, p) => s + (p.amount || 0), 0);
            const expensesTotal = this.dateFilteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
            const cashIn = this.dateFilteredEntries.reduce((s, e) => s + (e.Cash || 0), 0);
            const chequeIn = this.dateFilteredEntries.reduce((s, e) => s + (e.Cheque || 0), 0);
            const purchasePaid = this.dateFilteredPurchases.reduce((s, p) => s + (p.paidCash || 0) + (p.paidCheque || 0), 0);
            const stockKg = this.dateFilteredPurchases.reduce((s, p) => s + (p.qty || 0), 0) -
                this.dateFilteredEntries.reduce((s, e) => s + (e['N.Kilo'] || 0), 0);

            return {
                sales, purchases: purchasesTotal, expenses: expensesTotal,
                cashIn, chequeIn,
                grossProfit: sales - purchasesTotal,
                netProfit: sales - purchasesTotal - expensesTotal,
                outstanding: this.dateFilteredEntries.reduce((s, e) => s + (e.Balance || 0), 0),
                stockKg: Math.max(0, stockKg), stockValue: 0,
                purchaseOwed: this.dateFilteredPurchases.reduce((s, p) => s + (p.balance || 0), 0),
                purchasePaid,
                netCashflow: cashIn - this.dateFilteredExpenses.filter(e => e.mode === 'cash').reduce((s, e) => s + e.amount, 0) -
                    this.dateFilteredPurchases.reduce((s, p) => s + (p.paidCash || 0), 0),
            };
        },

        get filteredSalesRecords() {
            let records = this.dateFilteredEntries;
            const tab = this.recordsTab;
            if (tab === 'outstanding') records = records.filter(e => e.Balance > 0);
            else if (tab === 'paid') records = records.filter(e => e.Balance <= 0);

            const search = this.searchRecords.toLowerCase().trim();
            if (search) {
                records = records.filter(e =>
                    String(e['Bill No']).includes(search) ||
                    (e.Owner && e.Owner.toLowerCase().includes(search)) ||
                    (e.Customer && e.Customer.toLowerCase().includes(search)) ||
                    (e.Item && e.Item.toLowerCase().includes(search))
                );
            }
            return records.sort((a, b) => new Date(b.Date) - new Date(a.Date));
        },

        _getSummaries(key) {
            const summary = {};
            this.dateFilteredEntries.forEach(e => {
                const group = e[key];
                if (!group) return;
                if (!summary[group]) {
                    summary[group] = { [key.toLowerCase()]: group, revenue: 0, aAmount: 0, cash: 0, cheque: 0, balance: 0, count: 0 };
                }
                const s = summary[group];
                s.revenue += e['C.Amount'] || 0;
                s.aAmount += e['A.Amount'] || 0;
                s.cash += e.Cash || 0;
                s.cheque += e.Cheque || 0;
                s.balance += e.Balance || 0;
                s.count++;
            });
            return Object.values(summary).sort((a, b) => b.revenue - a.revenue);
        },
        get summariesByOwner() { return this._getSummaries('Owner'); },
        get summariesByCustomer() { return this._getSummaries('Customer'); },
        get summariesByOutstanding() {
            return this.summariesByOwner.filter(s => s.balance > 0).sort((a, b) => b.balance - a.balance);
        },

        get filteredOwnerSummaries() {
            const q = this.searchOwner.toLowerCase();
            return q ? this.summariesByOwner.filter(s => s.owner.toLowerCase().includes(q)) : this.summariesByOwner;
        },
        get filteredCustomerSummaries() {
            const q = this.searchCustomer.toLowerCase();
            return q ? this.summariesByCustomer.filter(s => s.customer.toLowerCase().includes(q)) : this.summariesByCustomer;
        },
        get filteredSummariesByOutstanding() {
            const q = this.searchOutstanding.toLowerCase();
            return q ? this.summariesByOutstanding.filter(s => s.owner.toLowerCase().includes(q)) : this.summariesByOutstanding;
        },

        get ownerGrandTotal() { return this.filteredOwnerSummaries.reduce((a, s) => a + s.revenue, 0); },
        get customerGrandTotal() { return this.filteredCustomerSummaries.reduce((a, s) => a + s.revenue, 0); },

        _getFilteredRecords(key, filterValue, outstandingOnly = false) {
            const records = filterValue
                ? this.dateFilteredEntries.filter(e => e[key] === filterValue)
                : this.dateFilteredEntries;
            return outstandingOnly ? records.filter(e => e.Balance > 0) : records;
        },
        get ownerFilteredRecords() { return this._getFilteredRecords('Owner', this.searchOwner); },
        get customerFilteredRecords() { return this._getFilteredRecords('Customer', this.searchCustomer); },
        get outstandingFilteredRecords() { return this._getFilteredRecords('Owner', this.searchOutstanding, true); },

        _getRecordsTotals(records) {
            return records.reduce((t, e) => {
                t.nKilo += e['N.Kilo'] || 0;
                t.cAmount += e['C.Amount'] || 0;
                t.aAmount += e['A.Amount'] || 0;
                t.cash += e.Cash || 0;
                t.cheque += e.Cheque || 0;
                t.balance += e.Balance || 0;
                return t;
            }, { nKilo: 0, cAmount: 0, aAmount: 0, cash: 0, cheque: 0, balance: 0 });
        },
        get ownerFilteredRecordsTotals() { return this._getRecordsTotals(this.ownerFilteredRecords); },
        get customerFilteredRecordsTotals() { return this._getRecordsTotals(this.customerFilteredRecords); },
        get outstandingFilteredRecordsTotals() { return this._getRecordsTotals(this.outstandingFilteredRecords); },

        get plAnalysis() {
            let entries = this.dateFilteredEntries;
            if (this.analysisOwner) entries = entries.filter(e => e.Owner === this.analysisOwner);
            if (this.analysisCustomer) entries = entries.filter(e => e.Customer === this.analysisCustomer);

            const totalRevenue = entries.reduce((s, e) => s + (e['C.Amount'] || 0), 0);
            const totalPurchases = this.dateFilteredPurchases.reduce((s, p) => s + (p.amount || 0), 0);
            const totalExpenses = this.dateFilteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
            const grossProfit = totalRevenue - totalPurchases;

            return {
                totalRevenue, totalPurchases, totalExpenses, grossProfit,
                netProfit: grossProfit - totalExpenses,
                totalCash: entries.reduce((s, e) => s + (e.Cash || 0), 0),
                totalCheque: entries.reduce((s, e) => s + (e.Cheque || 0), 0),
                totalOutstanding: entries.reduce((s, e) => s + (e.Balance || 0), 0),
            };
        },

        get monthlyPL() {
            const monthly = {};
            const add = (dateStr, amount, type) => {
                if (!dateStr) return;
                const m = dateStr.substring(0, 7);
                if (!monthly[m]) monthly[m] = { month: m, sales: 0, purchases: 0, expenses: 0 };
                monthly[m][type] += amount;
            };
            this.dateFilteredEntries.forEach(e => add(e.Date, e['C.Amount'], 'sales'));
            this.dateFilteredPurchases.forEach(p => add(p.date, p.amount, 'purchases'));
            this.dateFilteredExpenses.forEach(e => add(e.date, e.amount, 'expenses'));

            return Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)).map(m => {
                const gp = m.sales - m.purchases;
                const np = gp - m.expenses;
                return {
                    ...m,
                    monthLabel: new Date(m.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' }),
                    grossProfit: gp, netProfit: np,
                    margin: m.sales > 0 ? (np / m.sales) * 100 : 0,
                };
            });
        },

        get expenseCategoryBreakdown() {
            const byCat = {};
            this.dateFilteredExpenses.forEach(e => {
                const cat = e.category || 'Uncategorized';
                if (!byCat[cat]) byCat[cat] = { category: cat, amount: 0, count: 0 };
                byCat[cat].amount += e.amount || 0;
                byCat[cat].count++;
            });
            const total = this.totals.expenses;
            return Object.values(byCat)
                .map(c => ({ ...c, pct: total > 0 ? (c.amount / total) * 100 : 0 }))
                .sort((a, b) => b.amount - a.amount);
        },

        get agingAnalysis() {
            const now = new Date();
            const buckets = { current: 0, days30: 0, days60: 0, over90: 0 };
            this.dateFilteredEntries.filter(e => e.Balance > 0 && e.Date).forEach(e => {
                const diff = Math.floor((now - new Date(e.Date)) / 86400000);
                if (diff <= 30) buckets.current += e.Balance;
                else if (diff <= 60) buckets.days30 += e.Balance;
                else if (diff <= 90) buckets.days60 += e.Balance;
                else buckets.over90 += e.Balance;
            });
            return buckets;
        },
        get agingRows() {
            const now = new Date();
            const map = {};
            this.dateFilteredEntries.filter(e => e.Balance > 0 && e.Owner && e.Date).forEach(e => {
                if (!map[e.Owner]) map[e.Owner] = { owner: e.Owner, current: 0, d30: 0, d60: 0, over: 0 };
                const diff = Math.floor((now - new Date(e.Date)) / 86400000);
                const r = map[e.Owner];
                if (diff <= 30) r.current += e.Balance;
                else if (diff <= 60) r.d30 += e.Balance;
                else if (diff <= 90) r.d60 += e.Balance;
                else r.over += e.Balance;
            });
            return Object.values(map).sort((a, b) => (b.current + b.d30 + b.d60 + b.over) - (a.current + a.d30 + a.d60 + a.over));
        },

        get filteredPurchases() {
            let records = this.dateFilteredPurchases;
            const q = this.searchPurchases.toLowerCase();
            if (q) records = records.filter(p =>
                (p.billNo && String(p.billNo).toLowerCase().includes(q)) ||
                (p.supplier && p.supplier.toLowerCase().includes(q)) ||
                (p.item && p.item.toLowerCase().includes(q))
            );
            return records.sort((a, b) => new Date(b.date) - new Date(a.date));
        },

        get filteredCheques() {
            let cheques = this.cheques;
            const { filterFrom, filterTo, chequeTab } = this;
            if (filterFrom || filterTo) {
                cheques = cheques.filter(c => {
                    const date = new Date(c.date);
                    const from = filterFrom ? new Date(filterFrom) : null;
                    const to = filterTo ? new Date(filterTo) : null;
                    return (!from || date >= from) && (!to || date <= to);
                });
            }
            if (chequeTab !== 'all') cheques = cheques.filter(c => c.type === chequeTab || c.status === chequeTab);
            return cheques.sort((a, b) => new Date(b.date) - new Date(a.date));
        },

        get filteredExpenses() {
            let exp = this.dateFilteredExpenses;
            const q = this.searchExpenses.toLowerCase();
            if (q) exp = exp.filter(e =>
                (e.category && e.category.toLowerCase().includes(q)) ||
                (e.description && e.description.toLowerCase().includes(q)) ||
                (e.paidTo && e.paidTo.toLowerCase().includes(q))
            );
            return exp.sort((a, b) => new Date(b.date) - new Date(a.date));
        },

        get debtorsList() {
            return this.summariesByOwner.filter(s => s.balance > 0).map(s => ({
                ...s,
                pct: this.totals.outstanding > 0 ? (s.balance / this.totals.outstanding) * 100 : 0
            }));
        },
        get creditorsList() {
            const bySupplier = {};
            this.dateFilteredPurchases.forEach(p => {
                if (!p.supplier) return;
                if (!bySupplier[p.supplier]) bySupplier[p.supplier] = { supplier: p.supplier, total: 0, cash: 0, cheque: 0, balance: 0 };
                const s = bySupplier[p.supplier];
                s.total += p.amount || 0;
                s.cash += p.paidCash || 0;
                s.cheque += p.paidCheque || 0;
                s.balance += p.balance || 0;
            });
            const total = this.totals.purchaseOwed;
            return Object.values(bySupplier).filter(s => s.balance > 0).map(s => ({
                ...s, pct: total > 0 ? (s.balance / total) * 100 : 0
            }));
        },

        // ─── Formatters ───────────────────────────────────────────
        fc(v) {
            return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(v || 0);
        },
        fn(v) {
            if (v === undefined || v === null || v === '' || isNaN(v)) return '0';
            return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
        },
        fd(d) {
            if (!d) return '';
            const p = String(d).split('-');
            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
        },

        // ─── View Management ──────────────────────────────────────
        setView(view) {
            const validViews = ['dashboard', 'records', 'entry', 'purchases', 'cheques', 'cashflow', 'analysis', 'debtors', 'financials', 'master'];
            if (validViews.includes(view)) {
                this.view = view;
                this.sidebarOpen = false;
                if (view === 'dashboard' || view === 'analysis') {
                    setTimeout(() => this.updateCharts(), 80);
                }
            }
        },

        // ─── Toasts & Notifications ───────────────────────────────
        toast(title, msg, type = 'info') {
            const id = Date.now() + Math.random();
            const toast = { id, title, msg, type, time: new Date() };
            this.toasts.push(toast);
            setTimeout(() => this.removeToast(id), 4000);
            this.notifications.unshift(toast);
            if (this.notifications.length > 50) this.notifications.pop();
            this.unreadNotificationCount++;
        },
        removeToast(id) { this.toasts = this.toasts.filter(t => t.id !== id); },

        toggleNotificationCenter() {
            this.showNotificationCenter = !this.showNotificationCenter;
            if (this.showNotificationCenter) this.unreadNotificationCount = 0;
        },
        clearNotifications() {
            this.notifications = [];
            this.unreadNotificationCount = 0;
            this.showNotificationCenter = false;
        },

        // ─── Modal ────────────────────────────────────────────────
        showModal(title, message, onConfirm, onCancel = null) {
            this.modal = { show: true, title, message, onConfirm, onCancel };
        },
        closeModal() {
            if (typeof this.modal.onCancel === 'function') this.modal.onCancel();
            this.modal.show = false;
        },

        // ─── Form Defaults & Reset ────────────────────────────────
        get defaultSaleForm() {
            return {
                id: null, Date: new Date().toISOString().split('T')[0], 'Bill No': '',
                Owner: '', Customer: '', Item: '', Mark: '', N: '',
                Pkgs: 0, 'P.Kilo': 0, 'G.Kilo': 0, Tare: 0, 'N.Kilo': 0,
                Rate: 0, Kooli: 0, 'C.Amount': 0, 'A.Amount': 0,
                Cash: 0, Cheque: 0, 'Credit Given': 0, 'Credit Received': 0, Balance: 0,
                Remark: '', creditGivenIsManual: false,
            };
        },
        get defaultPurchaseForm() {
            return {
                id: null, date: new Date().toISOString().split('T')[0], billNo: '',
                supplier: '', item: '', qty: 0, rate: 0, amount: 0, extra: 0,
                paidCash: 0, paidCheque: 0, credit: 0, balance: 0, remark: '',
            };
        },
        get defaultExpenseForm() {
            return {
                id: null, date: new Date().toISOString().split('T')[0], category: '',
                description: '', amount: 0, mode: 'cash', paidTo: '', type: 'expense', ref: '',
            };
        },
        get defaultChequeForm() {
            return {
                id: null, date: new Date().toISOString().split('T')[0], chequeNo: '',
                bank: '', party: '', amount: 0, type: 'received', status: 'pending', clearDate: '', remark: '',
            };
        },

        resetSaleForm() {
            this.saleForm = JSON.parse(JSON.stringify(this.defaultSaleForm));
            this.newOwnerMode = false;
            this.newCustMode = false;
            this.newItemMode = false;
        },
        resetPurchaseForm() { this.purchaseForm = JSON.parse(JSON.stringify(this.defaultPurchaseForm)); },
        resetExpenseForm() { this.expenseForm = JSON.parse(JSON.stringify(this.defaultExpenseForm)); },
        resetChequeForm() { this.chequeForm = JSON.parse(JSON.stringify(this.defaultChequeForm)); },

        // ─── Calculations ─────────────────────────────────────────
        calcSale() {
            const f = this.saleForm;
            if (f['G.Kilo'] > 0 && f.Tare > 0) {
                f['N.Kilo'] = Math.max(0, (f['G.Kilo'] || 0) - (f.Tare || 0));
            }
            f['C.Amount'] = (f['N.Kilo'] || 0) * (f.Rate || 0) + (f.Kooli || 0);
            this.calcSaleBalance();
        },
        calcSaleBalance() {
            const f = this.saleForm;
            if (!f.creditGivenIsManual) {
                f['Credit Given'] = Math.max(0, (f['C.Amount'] || 0) - (f['A.Amount'] || 0));
            }
            const paid = (f.Cash || 0) + (f.Cheque || 0) + (f['Credit Received'] || 0);
            f.Balance = Math.max(0, (f['C.Amount'] || 0) - paid);
        },
        calcPurchase() {
            const f = this.purchaseForm;
            f.amount = (f.qty || 0) * (f.rate || 0) + (f.extra || 0);
            this.calcPurchaseBalance();
        },
        calcPurchaseBalance() {
            const f = this.purchaseForm;
            f.balance = Math.max(0, (f.amount || 0) - (f.paidCash || 0) - (f.paidCheque || 0) - (f.credit || 0));
        },

        // ─── Sale CRUD ────────────────────────────────────────────
        saveSaleEntry() {
            const f = this.saleForm;
            if (!f.Date || !f.Owner || !f.Customer || !f.Item || !f['Bill No']) {
                this.toast('Validation Error', 'Please fill in Date, Bill No, Owner, Customer, and Item.', 'error');
                return;
            }
            this.calcSale();
            const entry = this.normalizeSaleEntry({ ...f });
            if (entry.id && this.entries.find(e => e.id === entry.id)) {
                this.entries = this.entries.map(e => e.id === entry.id ? entry : e);
                this.toast('Entry Updated', `Bill #${entry['Bill No']} has been updated.`, 'success');
            } else {
                entry.id = crypto.randomUUID();
                this.entries.unshift(entry);
                this.toast('Entry Saved', `Bill #${entry['Bill No']} has been created.`, 'success');
            }
            this.updateMastersFromEntry(entry);
            this.resetSaleForm();
            this.setView('records');
            this.schedulePersist();
        },

        editSaleEntry(entry) {
            this.saleForm = JSON.parse(JSON.stringify(this.normalizeSaleEntry(entry)));
            this.saleForm.creditGivenIsManual = true;
            this.setView('entry');
            this.toast('Editing', `Editing Bill #${entry['Bill No']}.`, 'info');
        },

        deleteSaleEntry(id) {
            const entry = this.entries.find(e => e.id === id);
            if (!entry) { this.toast('Error', 'Entry not found.', 'error'); return; }
            this.showModal('Confirm Delete', `Delete Bill #${entry['Bill No']} for ${entry.Owner}?`, () => {
                this.entries = this.entries.filter(e => e.id !== id);
                this.toast('Entry Deleted', `Bill #${entry['Bill No']} has been deleted.`, 'success');
                this.schedulePersist();
            });
        },

        // ─── Purchase CRUD ────────────────────────────────────────
        savePurchase() {
            const f = this.purchaseForm;
            if (!f.date || !f.supplier || !f.item) {
                this.toast('Validation Error', 'Please fill in Date, Supplier, and Item.', 'error');
                return;
            }
            this.calcPurchase();
            const purchase = { ...f };
            if (!purchase.id) purchase.id = crypto.randomUUID();
            if (this.purchases.find(p => p.id === purchase.id)) {
                this.purchases = this.purchases.map(p => p.id === purchase.id ? purchase : p);
                this.toast('Purchase Updated', `Purchase from ${purchase.supplier} updated.`, 'success');
            } else {
                this.purchases.unshift(purchase);
                this.toast('Purchase Saved', `Purchase from ${purchase.supplier} saved.`, 'success');
            }
            this.updateMastersFromPurchase(purchase);
            this.resetPurchaseForm();
            this.schedulePersist();
        },

        editPurchase(purchase) {
            this.purchaseForm = JSON.parse(JSON.stringify(purchase));
            this.setView('purchases');
        },
        deletePurchase(id) {
            const p = this.purchases.find(x => x.id === id);
            if (!p) return;
            this.showModal('Confirm Delete', `Delete purchase from ${p.supplier}?`, () => {
                this.purchases = this.purchases.filter(x => x.id !== id);
                this.toast('Deleted', 'Purchase entry deleted.', 'success');
                this.schedulePersist();
            });
        },

        // ─── Expense CRUD ─────────────────────────────────────────
        saveExpense() {
            const f = this.expenseForm;
            if (!f.date || !f.description || !f.amount) {
                this.toast('Validation Error', 'Please fill in Date, Description, and Amount.', 'error');
                return;
            }
            const expense = { ...f };
            if (!expense.id) expense.id = crypto.randomUUID();
            if (this.expenses.find(e => e.id === expense.id)) {
                this.expenses = this.expenses.map(e => e.id === expense.id ? expense : e);
                this.toast('Expense Updated', 'Expense entry updated.', 'success');
            } else {
                this.expenses.unshift(expense);
                this.toast('Expense Saved', 'Expense entry saved.', 'success');
            }
            this.resetExpenseForm();
            this.schedulePersist();
        },
        editExpense(expense) {
            this.expenseForm = JSON.parse(JSON.stringify(expense));
            this.setView('cashflow');
        },
        deleteExpense(id) {
            const e = this.expenses.find(x => x.id === id);
            if (!e) return;
            this.showModal('Confirm Delete', `Delete expense "${e.description}" (${this.fc(e.amount)})?`, () => {
                this.expenses = this.expenses.filter(x => x.id !== id);
                this.toast('Deleted', 'Expense entry deleted.', 'success');
                this.schedulePersist();
            });
        },

        // ─── Cheque CRUD ──────────────────────────────────────────
        saveCheque() {
            const f = this.chequeForm;
            if (!f.date || !f.chequeNo || !f.amount) {
                this.toast('Validation Error', 'Please fill in Date, Cheque No, and Amount.', 'error');
                return;
            }
            const cheque = { ...f };
            if (!cheque.id) cheque.id = crypto.randomUUID();
            if (this.cheques.find(c => c.id === cheque.id)) {
                this.cheques = this.cheques.map(c => c.id === cheque.id ? cheque : c);
                this.toast('Cheque Updated', `Cheque #${cheque.chequeNo} updated.`, 'success');
            } else {
                this.cheques.unshift(cheque);
                this.toast('Cheque Saved', `Cheque #${cheque.chequeNo} recorded.`, 'success');
            }
            this.resetChequeForm();
            this.schedulePersist();
        },
        editCheque(cheque) {
            this.chequeForm = JSON.parse(JSON.stringify(cheque));
            this.setView('cheques');
        },
        deleteCheque(id) {
            const c = this.cheques.find(x => x.id === id);
            if (!c) return;
            this.showModal('Confirm Delete', `Delete cheque #${c.chequeNo} (${this.fc(c.amount)})?`, () => {
                this.cheques = this.cheques.filter(x => x.id !== id);
                this.toast('Deleted', 'Cheque entry deleted.', 'success');
                this.schedulePersist();
            });
        },
        updateChequeStatus(id, newStatus) {
            this.cheques = this.cheques.map(c => {
                if (c.id !== id) return c;
                return { ...c, status: newStatus, clearDate: newStatus === 'cleared' ? (c.clearDate || new Date().toISOString().split('T')[0]) : c.clearDate };
            });
            this.toast('Status Updated', `Cheque marked as "${newStatus}".`, 'success');
            this.schedulePersist();
        },

        // ─── Master Data ──────────────────────────────────────────
        addMasterItem(listName, value) {
            if (!value || !value.trim()) { this.toast('Error', 'Please enter a value.', 'error'); return; }
            const trimmed = value.trim();
            if (this[listName].includes(trimmed)) { this.toast('Duplicate', `"${trimmed}" already exists.`, 'info'); return; }
            this[listName].push(trimmed);
            this[listName].sort();
            this.toast('Added', `"${trimmed}" added.`, 'success');
            this.schedulePersist();
        },
        removeMasterItem(listName, value) {
            this.showModal('Confirm Remove', `Remove "${value}" from ${listName}?`, () => {
                this[listName] = this[listName].filter(x => x !== value);
                this.toast('Removed', `"${value}" removed.`, 'success');
                this.schedulePersist();
            });
        },

        updateMastersFromEntry(entry) {
            let changed = false;
            if (entry.Owner && !this.owners.includes(entry.Owner)) { this.owners.push(entry.Owner); this.owners.sort(); changed = true; }
            if (entry.Customer && !this.customers.includes(entry.Customer)) { this.customers.push(entry.Customer); this.customers.sort(); changed = true; }
            if (entry.Item && !this.items.includes(entry.Item)) { this.items.push(entry.Item); this.items.sort(); changed = true; }
            if (changed) this.schedulePersist();
        },
        updateMastersFromPurchase(purchase) {
            let changed = false;
            if (purchase.supplier && !this.suppliers.includes(purchase.supplier)) { this.suppliers.push(purchase.supplier); this.suppliers.sort(); changed = true; }
            if (purchase.item && !this.items.includes(purchase.item)) { this.items.push(purchase.item); this.items.sort(); changed = true; }
            if (changed) this.schedulePersist();
        },
        updateMastersFromData() {
            const newOwners = new Set(this.owners);
            this.entries.forEach(e => e.Owner && newOwners.add(e.Owner));
            this.owners = Array.from(newOwners).sort();
            const newCustomers = new Set(this.customers);
            this.entries.forEach(e => e.Customer && newCustomers.add(e.Customer));
            this.customers = Array.from(newCustomers).sort();
            const newItems = new Set(this.items);
            this.entries.forEach(e => e.Item && newItems.add(e.Item));
            this.purchases.forEach(p => p.item && newItems.add(p.item));
            this.items = Array.from(newItems).sort();
            const newSuppliers = new Set(this.suppliers);
            this.purchases.forEach(p => p.supplier && newSuppliers.add(p.supplier));
            this.suppliers = Array.from(newSuppliers).sort();
            this.toast('Master Data Updated', 'Dropdown lists updated.', 'info');
        },

        // ─── Charts ───────────────────────────────────────────────
        updateCharts() {
            try {
                if (typeof Chart === 'undefined') return;
                const plCanvas = document.getElementById('plChart');
                const itemCanvas = document.getElementById('itemChart');
                if (!plCanvas || !itemCanvas) return;

                if (this._charts.pl) { this._charts.pl.destroy(); }
                if (this._charts.item) { this._charts.item.destroy(); }

                const months = this.monthlyPL.slice(-12);
                if (months.length > 0) {
                    const labels = months.map(m => {
                        const d = new Date(m.month + '-02');
                        return d.toLocaleString('default', { month: 'short', year: '2-digit' });
                    });
                    this._charts.pl = new Chart(plCanvas, {
                        type: 'bar',
                        data: {
                            labels,
                            datasets: [
                                { label: 'Revenue', data: months.map(m => m.sales), backgroundColor: '#3b82f6', borderRadius: 4 },
                                { label: 'Expenses', data: months.map(m => m.expenses), backgroundColor: '#ef4444', borderRadius: 4 },
                                { label: 'Net Profit', data: months.map(m => m.netProfit), backgroundColor: '#10b981', borderRadius: 4 },
                            ]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } } },
                            scales: { y: { beginAtZero: true, ticks: { font: { size: 9 } } }, x: { ticks: { font: { size: 8 } } } }
                        }
                    });
                }

                const itemWeights = {};
                this.dateFilteredEntries.forEach(e => {
                    if (!e.Item) return;
                    itemWeights[e.Item] = (itemWeights[e.Item] || 0) + (e['N.Kilo'] || 0);
                });
                const topItems = Object.entries(itemWeights).sort((a, b) => b[1] - a[1]).slice(0, 5);
                if (topItems.length > 0) {
                    this._charts.item = new Chart(itemCanvas, {
                        type: 'doughnut',
                        data: {
                            labels: topItems.map(i => i[0]),
                            datasets: [{ data: topItems.map(i => i[1]), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } } }
                        }
                    });
                }
            } catch (e) {
                console.warn('Chart update failed:', e);
            }
        },

        // ─── Persistence (non-blocking, offline-first) ─────────────
        schedulePersist() {
            if (this._persistTimer) clearTimeout(this._persistTimer);
            this._persistTimer = setTimeout(() => { this._doPersist(); }, 1500);
        },

        buildAppData() {
            return {
                entries: this.entries, purchases: this.purchases,
                expenses: this.expenses, cheques: this.cheques,
                owners: this.owners, customers: this.customers,
                items: this.items, suppliers: this.suppliers,
                expenseCategories: this.expenseCategories,
                lastSaved: new Date().toISOString()
            };
        },

        applyCloudData(data) {
            this.entries = (data.entries || []).map(e => this.normalizeSaleEntry(e));
            this.purchases = data.purchases || [];
            this.expenses = data.expenses || [];
            this.cheques = data.cheques || [];
            this.owners = data.owners || [];
            this.customers = data.customers || [];
            this.items = data.items || [];
            this.suppliers = data.suppliers || [];
            this.expenseCategories = data.expenseCategories || this.expenseCategories;
        },

        async _doPersist(suppressToast = false) {
            if (this._persistTimer) clearTimeout(this._persistTimer);
            const data = this.buildAppData();

            // Always save locally first (immediate, reliable)
            localStorage.setItem('am_accounts_v10', JSON.stringify(data));

            // Save to cloud in background (non-blocking, no loading overlay)
            try {
                await saveDataToSupabase(data);
                this.lastSyncTime = new Date().toISOString();
                this.cloudAvailable = true;
                if (!suppressToast) this.toast('Saved', 'Data synced to cloud.', 'success');
            } catch (error) {
                // Queue for retry
                this.syncQueue.push({ type: 'save', data, time: new Date().toISOString() });
                if (this.syncQueue.length > 10) this.syncQueue.shift();
                this.cloudAvailable = false;
                if (!suppressToast) this.toast('Cloud Sync', 'Saved locally. Cloud sync queued for retry.', 'info');
            }
        },

        async processSyncQueue() {
            if (this.syncQueue.length === 0) return;
            console.log(`Processing ${this.syncQueue.length} queued sync operations...`);
            while (this.syncQueue.length > 0) {
                const item = this.syncQueue.shift();
                try {
                    await saveDataToSupabase(item.data);
                    this.lastSyncTime = new Date().toISOString();
                    this.cloudAvailable = true;
                } catch (e) {
                    this.syncQueue.unshift(item); // Put back for next retry
                    console.warn('Sync queue retry deferred:', e.message);
                    break;
                }
            }
        },

        async syncToCloud() {
            this.toast('Syncing...', 'Force-saving all data to cloud.', 'info');
            await this._doPersist(true);
            this.toast('Sync Complete', 'Force sync completed.', 'success');
        },

        async loadCloudData() {
            this.toast('Loading...', 'Fetching latest data from cloud...', 'info');
            try {
                const data = await loadDataFromSupabase();
                this.applyCloudData(data);
                this.toast('Cloud Loaded', 'Data refreshed from cloud.', 'success');
            } catch (error) {
                this.toast('Cloud Load Error', error.message, 'error');
            }
        },

        // ─── AI Assistant ─────────────────────────────────────────
        async getAIInsight() {
            if (!this.aiPrompt.trim()) { this.toast('AI Assistant', 'Please enter a question.', 'warning'); return; }
            this.isAILoading = true;
            this.aiInsight = '';
            try {
                const context = JSON.stringify({
                    period: { from: this.filterFrom || 'start', to: this.filterTo || 'today' },
                    sales: { totalRevenue: this.totals.sales, transactionCount: this.entries.length },
                    profitability: {
                        grossProfit: this.totals.grossProfit, netProfit: this.totals.netProfit,
                        netMarginPercent: this.totals.sales > 0 ? (this.totals.netProfit / this.totals.sales * 100) : 0
                    },
                    outstandingDebtors: { totalOwed: this.totals.outstanding, count: this.summariesByOutstanding.length },
                    topCustomers: this.summariesByCustomer.slice(0, 5).map(c => ({ customer: c.customer, revenue: c.revenue })),
                }, null, 2);
                const fullPrompt = `You are a helpful financial assistant. Based on the following data summary, answer the user's question concisely.\n\n--- Data ---\n${context}\n---\n\nUser: "${this.aiPrompt}"`;
                this.aiInsight = await getGroqChatCompletion(fullPrompt);
            } catch (error) {
                this.aiInsight = `Failed to get AI response: ${error.message}`;
                this.toast('AI Error', error.message, 'error');
            } finally {
                this.isAILoading = false;
            }
        },

        // ─── Helpers ──────────────────────────────────────────────
        normalizeSaleEntry(e) {
            const numericFields = ['Pkgs', 'P.Kilo', 'G.Kilo', 'Tare', 'N.Kilo', 'Rate', 'Kooli', 'C.Amount', 'A.Amount', 'Cash', 'Cheque', 'Credit Given', 'Credit Received', 'Balance'];
            const entry = { ...e };
            numericFields.forEach(f => { entry[f] = parseFloat(entry[f]) || 0; });
            if (!entry.id) entry.id = crypto.randomUUID();
            return entry;
        },

        autoCategorizeExpense() {
            if (this.expenseForm.category && this.expenseForm.category.trim() !== '') return;
            const desc = (this.expenseForm.description || '').toLowerCase();
            if (!desc) return;
            for (const [cat, keywords] of Object.entries(this.expenseCategoryKeywords)) {
                if (keywords.some(kw => desc.includes(kw))) {
                    this.expenseForm.category = cat;
                    this.toast('Auto-Categorized', `Set category to "${cat}"`, 'info');
                    return;
                }
            }
        },

        // ─── Data Management ──────────────────────────────────────
        backupJSON() {
            const json = JSON.stringify(this.buildAppData(), null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `amfin_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.toast('Backup Complete', 'JSON backup downloaded.', 'success');
        },

        importJSON(event) {
            const file = event.target.files[0];
            if (!file) { this.toast('No file selected', 'Please select a JSON backup file.', 'warning'); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!data.entries && !data.owners) throw new Error('Invalid backup file.');
                    this.showModal('Confirm Import', 'This will OVERWRITE all data. Are you sure?', () => {
                        this.applyCloudData(data);
                        this.toast('Import Complete', 'Data restored from backup. Saving...', 'success');
                        this._doPersist();
                    }, () => {
                        event.target.value = '';
                        this.toast('Cancelled', 'Import cancelled.', 'info');
                    });
                } catch (error) {
                    this.toast('Import Error', error.message, 'error');
                }
            };
            reader.onerror = () => {
                this.toast('File Read Error', 'Could not read the file.', 'error');
                event.target.value = '';
            };
            reader.readAsText(file);
        },

        importExcel(event) {
            const file = event.target.files[0];
            if (!file) { this.toast('No file selected', 'Please select an Excel file.', 'warning'); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    const processSheet = (name, target, normalizer) => {
                        const sheet = workbook.Sheets[name];
                        if (!sheet) return;
                        let rows = XLSX.utils.sheet_to_json(sheet);
                        rows = rows.map(row => {
                            const r = { ...row };
                            ['Date', 'date', 'clearDate'].forEach(f => {
                                if (r[f] && r[f] instanceof Date) {
                                    const d = r[f];
                                    r[f] = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                }
                            });
                            return normalizer ? normalizer(r) : r;
                        });
                        this[target] = rows;
                    };

                    processSheet('Sales', 'entries', this.normalizeSaleEntry.bind(this));
                    processSheet('Purchases', 'purchases');
                    processSheet('Expenses', 'expenses');
                    processSheet('Cheques', 'cheques');
                    this.toast('Import Complete', 'Excel data processed.', 'success');
                    this.updateMastersFromData();
                    this.schedulePersist();
                } catch (error) {
                    this.toast('Import Error', error.message, 'error');
                } finally {
                    event.target.value = '';
                }
            };
            reader.onerror = () => {
                this.toast('File Read Error', 'Could not read the file.', 'error');
                event.target.value = '';
            };
            reader.readAsArrayBuffer(file);
        },

        exportExcel() {
            try {
                const wb = XLSX.utils.book_new();
                if (this.entries.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.entries), 'Sales');
                if (this.purchases.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.purchases), 'Purchases');
                if (this.expenses.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.expenses), 'Expenses');
                if (this.cheques.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.cheques), 'Cheques');
                if (this.owners.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.owners.map(o => ({ Owner: o }))), 'Owners');
                if (this.customers.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.customers.map(c => ({ Customer: c }))), 'Customers');
                if (this.items.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.items.map(i => ({ Item: i }))), 'Items');
                if (this.suppliers.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.suppliers.map(s => ({ Supplier: s }))), 'Suppliers');
                XLSX.writeFile(wb, `amfin_export_${new Date().toISOString().split('T')[0]}.xlsx`);
                this.toast('Export Complete', 'Excel file downloaded.', 'success');
            } catch (error) {
                this.toast('Export Error', error.message, 'error');
            }
        },

        async clearAllData() {
            this.showModal('Confirm Delete All Data', 'This will permanently delete ALL data from local device and cloud. This cannot be undone.',
                async () => {
                    this.isLoading = true;
                    this.loadingMsg = 'Deleting all cloud data...';
                    try {
                        await clearAllSupabaseData();
                        this.toast('Success', 'All cloud data deleted. App will reload.', 'success');
                        localStorage.removeItem('am_accounts_v10');
                        setTimeout(() => location.reload(), 2000);
                    } catch (error) {
                        this.toast('Error', 'Could not clear cloud data: ' + error.message, 'error');
                        this.isLoading = false;
                    }
                });
        },

        findBill() {
            if (!this.billSearch.trim()) { this.foundBill = null; return; }
            this.foundBill = this.entries.find(e => String(e['Bill No']) === this.billSearch.trim()) || null;
        },

        loadBillIntoForm(bill) {
            this.saleForm = JSON.parse(JSON.stringify(bill));
            this.setView('entry');
            this.toast('Entry Loaded', `Bill #${bill['Bill No']} loaded.`, 'info');
            this.foundBill = null;
            this.billSearch = '';
        },

        // ─── PRINT FUNCTIONS ───────────────────────────────────────
        _generateSalesTableHTML(records, totals, title, columns) {
            const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const isValueCol = (c) => ['C.Amount','A.Amount','Cash','Cheque','Balance','Rate','N.Kilo','P.Kilo','G.Kilo','Tare','Pkgs'].includes(c);
            let html = `                <div class="print-header">
                    <h1>AM Sales - Pro Accounting v10</h1>
                    <h2>${title}</h2>
                    <p>Generated: ${dateStr}</p>
                </div>
                <table class="print-table">
                    <thead><tr>${columns.map(c => `<th class="${isValueCol(c) ? 'text-right' : 'text-left'}">${c}</th>`).join('')}</tr></thead>
                    <tbody>${records.map(e => `<tr>${columns.map(c => {
                        if (c === 'Date') return '<td>' + this.fd(e[c]) + '</td>';
                        if (c === 'Bill No') return '<td class="font-bold">#' + e[c] + '</td>';
                        if (['C.Amount','A.Amount','Cash','Cheque','Balance'].includes(c)) return '<td class="text-right">' + this.fc(e[c]) + '</td>';
                        if (['Pkgs','N.Kilo','P.Kilo','G.Kilo','Tare','Rate'].includes(c)) return '<td class="text-right">' + this.fn(e[c]) + '</td>';
                        return '<td>' + (e[c] || '') + '</td>';
                    }).join('')}</tr>`).join('')}</tbody>${totals ? '<tfoot><tr>' + columns.map(c => {
                        if (c === 'Date') return '<td class="text-right font-bold" colspan="2">TOTALS</td>';
                        if (c === 'Bill No') return '<td>(' + records.length + ')</td>';
                        if (c === 'C.Amount') return '<td class="text-right">' + this.fc(totals.cAmount) + '</td>';
                        if (c === 'A.Amount') return '<td class="text-right">' + this.fc(totals.aAmount) + '</td>';
                        if (c === 'Cash') return '<td class="text-right">' + this.fc(totals.cash) + '</td>';
                        if (c === 'Cheque') return '<td class="text-right">' + this.fc(totals.cheque) + '</td>';
                        if (c === 'Balance') return '<td class="text-right">' + this.fc(totals.balance) + '</td>';
                        if (c === 'N.Kilo') return '<td class="text-right">' + this.fn(totals.nKilo) + ' KG</td>';
                        return '<td></td>';
                    }).join('') + '</tr></tfoot>' : ''}</table>`;
            return html;
        },

        printDetailedReport(type, filter = '', onlyOutstanding = false) {
            let records, title, totals;
            const dateRange = this.filterFrom || this.filterTo ? '(' + (this.fd(this.filterFrom)||'start') + ' ' + String.fromCharCode(8594) + ' ' + (this.fd(this.filterTo)||'today') + ')' : '';
            const suffix = onlyOutstanding ? ' (Outstanding Only)' : '';
            switch (type) {
                case 'Owner':
                    records = this.ownerFilteredRecords; totals = this.ownerFilteredRecordsTotals;
                    title = 'Detailed Sales Report by Owner: ' + (filter || 'All') + ' ' + dateRange + suffix;
                    break;
                case 'Customer':
                    records = this.customerFilteredRecords; totals = this.customerFilteredRecordsTotals;
                    title = 'Detailed Sales Report by Customer: ' + (filter || 'All') + ' ' + dateRange + suffix;
                    break;
                default:
                    records = this.filteredSalesRecords;
                    totals = this.filteredSalesRecords.reduce((a, e) => { a.nKilo+=+e['N.Kilo']||0; a.cAmount+=+e['C.Amount']||0; a.aAmount+=+e['A.Amount']||0; a.cash+=+e.Cash||0; a.cheque+=+e.Cheque||0; a.balance+=+e.Balance||0; return a; }, {nKilo:0,cAmount:0,aAmount:0,cash:0,cheque:0,balance:0});
                    title = 'Detailed Sales Ledger ' + dateRange + suffix;
            }
            if (onlyOutstanding) records = records.filter(e => e.Balance > 0);
            const html = this._generateSalesTableHTML(records, totals, title, ['Date','Bill No','Owner','Customer','Item','Pkgs','N.Kilo','Rate','C.Amount','A.Amount','Cash','Cheque','Balance']);
            this._printHTML(html, title);
        },

        printCompactReport(type, filter = '', onlyOutstanding = false) {
            const dateRange = this.filterFrom || this.filterTo ? '(' + (this.fd(this.filterFrom)||'start') + ' ' + String.fromCharCode(8594) + ' ' + (this.fd(this.filterTo)||'today') + ')' : '';
            const suffix = onlyOutstanding ? ' (Outstanding Only)' : '';
            let records, title;
            if (type === 'Owner') { records = onlyOutstanding ? this.outstandingFilteredRecords : this.ownerFilteredRecords; title = 'Compact Report by Owner: ' + (filter||'All') + ' ' + dateRange + suffix; }
            else { records = onlyOutstanding ? this.customerFilteredRecords.filter(e=>e.Balance>0) : this.customerFilteredRecords; title = 'Compact Report by Customer: ' + (filter||'All') + ' ' + dateRange + suffix; }
            const totals = records.reduce((a,e)=>{a.nKilo+=+e['N.Kilo']||0; a.aAmount+=+e['A.Amount']||0; a.balance+=+e.Balance||0; return a;}, {nKilo:0,aAmount:0,balance:0});
            this._printHTML(this._generateSalesTableHTML(records, totals, title, ['Date','Bill No','Owner','Item','Customer','Pkgs','N.Kilo','A.Amount','Balance']), title);
        },

        printSummaryTable(type, summaries) {
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            const dateRange = this.filterFrom||this.filterTo ? '('+(this.fd(this.filterFrom)||'start')+' '+String.fromCharCode(8594)+' '+(this.fd(this.filterTo)||'today')+')' : '';
            const key = type === 'Owner' ? 'owner' : 'customer';
            const valueKey = type === 'Owner' ? 'Owner' : 'Customer';
            let rows = '';
            summaries.forEach(s => { rows += '<tr><td>'+s[key]+'</td><td class="text-right">'+this.fn(s.revenue)+'</td><td class="text-right">'+this.fn(s.aAmount)+'</td><td class="text-right">'+this.fn(s.cash)+'</td><td class="text-right">'+this.fn(s.cheque)+'</td><td class="text-right">'+this.fn(s.balance)+'</td><td class="text-right">'+s.count+'</td></tr>'; });
            const totalSummary = summaries.reduce((a,s)=>({revenue:a.revenue+s.revenue,aAmount:a.aAmount+s.aAmount,cash:a.cash+s.cash,cheque:a.cheque+s.cheque,balance:a.balance+s.balance,count:a.count+s.count}),{revenue:0,aAmount:0,cash:0,cheque:0,balance:0,count:0});
            const html = '                <div class="print-header"><h1>AM Sales - Pro Accounting v10</h1><h2>'+type+' Summary Report '+dateRange+'</h2><p>Generated: '+dateStr+'</p></div>                <table class="print-table"><thead><tr><th class="text-left">'+valueKey+'</th><th class="text-right">Revenue</th><th class="text-right">Actual</th><th class="text-right">Cash</th><th class="text-right">Cheque</th><th class="text-right">Balance</th><th class="text-right">Count</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td class="font-bold">GRAND TOTAL ('+summaries.length+')</td><td class="text-right">'+this.fn(totalSummary.revenue)+'</td><td class="text-right">'+this.fn(totalSummary.aAmount)+'</td><td class="text-right">'+this.fn(totalSummary.cash)+'</td><td class="text-right">'+this.fn(totalSummary.cheque)+'</td><td class="text-right">'+this.fn(totalSummary.balance)+'</td><td class="text-right">'+totalSummary.count+'</td></tr></tfoot></table>';
            this._printHTML(html, type+' Summary Report');
        },

        printPLReport() {
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            const p = this.plAnalysis;
            const monthlyRows = this.monthlyPL.map(m => '<tr'+(m.netProfit<0?' class="text-rose-600"':'')+'><td>'+m.monthLabel+'</td><td class="text-right">'+this.fc(m.sales)+'</td><td class="text-right">'+this.fc(m.purchases)+'</td><td class="text-right">'+this.fc(m.grossProfit)+'</td><td class="text-right">'+this.fc(m.expenses)+'</td><td class="text-right font-bold">'+this.fc(m.netProfit)+'</td><td class="text-right">'+(m.sales>0?this.fn(m.margin)+'%':'-')+'</td></tr>').join('');
            const html = '                <div class="print-header"><h1>AM Sales - Pro Accounting v10</h1><h2>Profit & Loss Statement</h2><p>Generated: '+dateStr+'</p></div>                <div style="margin-bottom:20px;padding:12px;background:#f8fafc;border-radius:8px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:4px 8px;font-weight:bold;">Sales Revenue</td><td style="padding:4px 8px;text-align:right;">'+this.fc(p.totalRevenue)+'</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Less: COGS (Purchases)</td><td style="padding:4px 8px;text-align:right;">'+this.fc(p.totalPurchases)+'</td></tr><tr style="background:#dbeafe;"><td style="padding:4px 8px;font-weight:bold;">Gross Profit</td><td style="padding:4px 8px;text-align:right;font-weight:bold;">'+this.fc(p.grossProfit)+'</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Less: Operating Expenses</td><td style="padding:4px 8px;text-align:right;">'+this.fc(p.totalExpenses)+'</td></tr><tr style="background:'+(p.netProfit>=0?'#d1fae5':'#fee2e2')+'"><td style="padding:4px 8px;font-weight:bold;font-size:1.1em;">Net Profit / (Loss)</td><td style="padding:4px 8px;text-align:right;font-weight:bold;font-size:1.1em;">'+this.fc(p.netProfit)+'</td></tr><tr><td style="padding:4px 8px;">Net Margin</td><td style="padding:4px 8px;text-align:right;">'+(p.totalRevenue>0?this.fn(p.netProfit/p.totalRevenue*100)+'%':'-')+'</td></tr></table></div>                <h3 style="margin-bottom:10px;">Monthly Breakdown</h3>                <table class="print-table"><thead><tr><th>Month</th><th class="text-right">Sales</th><th class="text-right">Purchases</th><th class="text-right">Gross Profit</th><th class="text-right">Expenses</th><th class="text-right">Net Profit</th><th class="text-right">Margin</th></tr></thead><tbody>'+monthlyRows+'</tbody></table>';
            this._printHTML(html, 'Profit & Loss Statement');
        },

        printOutstandingReport(filterOwner = '') {
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            let records = filterOwner ? this.dateFilteredEntries.filter(e=>e.Owner===filterOwner&&e.Balance>0) : this.dateFilteredEntries.filter(e=>e.Balance>0);
            const totals = records.reduce((a,e)=>{a.nKilo+=+e['N.Kilo']||0; a.aAmount+=+e['A.Amount']||0; a.balance+=+e.Balance||0; return a;}, {nKilo:0,aAmount:0,balance:0});
            this._printHTML(this._generateSalesTableHTML(records, totals, 'Outstanding Dues Report '+(filterOwner?'- '+filterOwner:''), ['Date','Bill No','Owner','Customer','Item','Pkgs','N.Kilo','A.Amount','Balance']), 'Outstanding Report');
        },

        printInvoice(entry) {
            const e = this.normalizeSaleEntry(entry);
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            const html = '                <div class="print-header"><h1>AM Sales - Pro Accounting v10</h1><p>Invoice #'+e['Bill No']+' | Date: '+this.fd(e.Date)+'</p></div>                <div style="margin-bottom:20px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:4px 8px;font-weight:bold;">Owner:</td><td style="padding:4px 8px;">'+e.Owner+'</td><td style="padding:4px 8px;font-weight:bold;">Customer:</td><td style="padding:4px 8px;">'+e.Customer+'</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Item:</td><td style="padding:4px 8px;">'+e.Item+'</td><td style="padding:4px 8px;font-weight:bold;">Mark/N:</td><td style="padding:4px 8px;">'+(e.Mark||'')+' '+(e.N||'')+'</td></tr></table></div>                <table class="print-table"><thead><tr><th>Description</th><th class="text-right">Value</th></tr></thead><tbody><tr><td>Packages</td><td class="text-right">'+this.fn(e.Pkgs)+'</td></tr><tr><td>P.Kilo</td><td class="text-right">'+this.fn(e['P.Kilo'])+'</td></tr><tr><td>G.Kilo</td><td class="text-right">'+this.fn(e['G.Kilo'])+'</td></tr><tr><td>Tare</td><td class="text-right">'+this.fn(e.Tare)+'</td></tr><tr><td>N.Kilo (Net Weight)</td><td class="text-right font-bold">'+this.fn(e['N.Kilo'])+' KG</td></tr><tr><td>Rate</td><td class="text-right">'+this.fc(e.Rate)+'/KG</td></tr><tr style="background:#dbeafe;font-weight:bold;"><td>Calculated Amount</td><td class="text-right">'+this.fc(e['C.Amount'])+'</td></tr><tr><td>Actual Amount</td><td class="text-right">'+this.fc(e['A.Amount'])+'</td></tr><tr><td>Cash Received</td><td class="text-right">'+this.fc(e.Cash)+'</td></tr><tr><td>Cheque Received</td><td class="text-right">'+this.fc(e.Cheque)+'</td></tr><tr><td>Balance Due</td><td class="text-right font-bold" style="color:'+((e.Balance||0)>0?'#dc2626':'#059669')+';">'+this.fc(e.Balance)+'</td></tr></tbody></table>                <div style="margin-top:16px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;"><div><p style="font-size:10px;color:#666;">Remark: '+(e.Remark||'-')+'</p></div><div><p style="font-size:10px;color:#666;">Authorized Signature</p><div style="height:30px;width:120px;border-bottom:1px solid #333;margin-top:4px;"></div></div></div>';
            this._printHTML(html, 'Invoice #'+e['Bill No']);
        },

        printPurchasesReport() {
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            const records = this.filteredPurchases;
            const totals = records.reduce((a,p)=>{a.qty+=+p.qty||0; a.amount+=+p.amount||0; a.paid+=(+p.paidCash||0)+(+p.paidCheque||0); a.balance+=+p.balance||0; return a;},{qty:0,amount:0,paid:0,balance:0});
            const html = '                <div class="print-header"><h1>AM Sales - Pro Accounting v10</h1><h2>Purchase Records Report</h2><p>Generated: '+dateStr+'</p></div>                <table class="print-table"><thead><tr><th>Date</th><th>Bill#</th><th>Supplier</th><th>Item</th><th class="text-right">Qty KG</th><th class="text-right">Rate</th><th class="text-right">Amount</th><th class="text-right">Paid</th><th class="text-right">Balance</th><th>Remark</th></tr></thead><tbody>'+records.map(p=>'<tr><td>'+this.fd(p.date)+'</td><td class="font-bold">'+(p.billNo?'#'+p.billNo:'-')+'</td><td>'+p.supplier+'</td><td>'+p.item+'</td><td class="text-right">'+this.fn(p.qty)+'</td><td class="text-right">'+this.fn(p.rate)+'</td><td class="text-right">'+this.fc(p.amount)+'</td><td class="text-right">'+this.fc((+p.paidCash||0)+(+p.paidCheque||0))+'</td><td class="text-right">'+this.fc(p.balance)+'</td><td>'+(p.remark||'')+'</td></tr>').join('')+'</tbody><tfoot><tr><td colspan="4" class="font-bold text-right">TOTAL ('+records.length+')</td><td class="text-right">'+this.fn(totals.qty)+'</td><td></td><td class="text-right">'+this.fc(totals.amount)+'</td><td class="text-right">'+this.fc(totals.paid)+'</td><td class="text-right">'+this.fc(totals.balance)+'</td><td></td></tr></tfoot></table>';
            this._printHTML(html, 'Purchase Records Report');
        },

        printExpensesReport() {
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            const records = this.filteredExpenses;
            const catBreakdown = this.expenseCategoryBreakdown;
            const total = records.reduce((a,e)=>a+(+e.amount||0),0);
            let catRows = catBreakdown.map(c=>'<tr><td>'+c.category+'</td><td class="text-right">'+c.count+'</td><td class="text-right">'+this.fc(c.amount)+'</td><td class="text-right">'+this.fn(c.pct)+'%</td></tr>').join('');
            const html = '                <div class="print-header"><h1>AM Sales - Pro Accounting v10</h1><h2>Expenses Report</h2><p>Generated: '+dateStr+'</p></div>                <h3>Detail</h3>                <table class="print-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="text-right">Amount</th><th>Mode</th></tr></thead><tbody>'+records.map(e=>'<tr><td>'+this.fd(e.date)+'</td><td>'+e.category+'</td><td>'+e.description+'</td><td class="text-right">'+this.fc(e.amount)+'</td><td>'+e.mode+'</td></tr>').join('')+'</tbody><tfoot><tr><td colspan="3" class="font-bold text-right">TOTAL ('+records.length+')</td><td class="text-right">'+this.fc(total)+'</td><td></td></tr></tfoot></table>                <h3 style="margin-top:20px;">By Category</h3>                <table class="print-table"><thead><tr><th>Category</th><th class="text-right">Count</th><th class="text-right">Amount</th><th class="text-right">%</th></tr></thead><tbody>'+catRows+'</tbody><tfoot><tr><td class="font-bold">TOTAL</td><td class="text-right">'+records.length+'</td><td class="text-right">'+this.fc(total)+'</td><td class="text-right">100%</td></tr></tfoot></table>';
            this._printHTML(html, 'Expenses Report');
        },

        printDebtorsReport() {
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            const debtors = this.debtorsList;
            const totals = debtors.reduce((a,d)=>({revenue:a.revenue+d.revenue,cash:a.cash+d.cash,cheque:a.cheque+d.cheque,creditGiven:a.creditGiven+d.creditGiven,balance:a.balance+d.balance}),{revenue:0,cash:0,cheque:0,creditGiven:0,balance:0});
            const rows = debtors.map((d,i)=>'<tr><td>'+(i+1)+'</td><td class="font-bold">'+d.owner+'</td><td class="text-right">'+this.fn(d.revenue)+'</td><td class="text-right">'+this.fn(d.cash)+'</td><td class="text-right">'+this.fn(d.cheque)+'</td><td class="text-right">'+this.fn(d.creditGiven)+'</td><td class="text-right font-bold" style="color:#dc2626;">'+this.fn(d.balance)+'</td><td class="text-right">'+this.fn(d.pct)+'%</td></tr>').join('');
            const html = '                <div class="print-header"><h1>AM Sales - Pro Accounting v10</h1><h2>Sales Debtors Report</h2><p>Generated: '+dateStr+'</p></div>                <table class="print-table"><thead><tr><th>#</th><th>Owner</th><th class="text-right">Revenue</th><th class="text-right">Cash</th><th class="text-right">Cheque</th><th class="text-right">Credit Given</th><th class="text-right">Outstanding</th><th class="text-right">%</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2" class="font-bold">GRAND TOTAL ('+debtors.length+')</td><td class="text-right">'+this.fn(totals.revenue)+'</td><td class="text-right">'+this.fn(totals.cash)+'</td><td class="text-right">'+this.fn(totals.cheque)+'</td><td class="text-right">'+this.fn(totals.creditGiven)+'</td><td class="text-right">'+this.fn(totals.balance)+'</td><td class="text-right">100%</td></tr></tfoot></table>';
            this._printHTML(html, 'Sales Debtors Report');
        },

        printCreditorsReport() {
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            const creditors = this.creditorsList;
            const totals = creditors.reduce((a,c)=>({total:a.total+c.total,cash:a.cash+c.cash,cheque:a.cheque+c.cheque,balance:a.balance+c.balance}),{total:0,cash:0,cheque:0,balance:0});
            const rows = creditors.map((c,i)=>'<tr><td>'+(i+1)+'</td><td class="font-bold">'+c.supplier+'</td><td class="text-right">'+this.fn(c.total)+'</td><td class="text-right">'+this.fn(c.cash)+'</td><td class="text-right">'+this.fn(c.cheque)+'</td><td class="text-right font-bold" style="color:#dc2626;">'+this.fn(c.balance)+'</td><td class="text-right">'+this.fn(c.pct)+'%</td></tr>').join('');
            const html = '                <div class="print-header"><h1>AM Sales - Pro Accounting v10</h1><h2>Purchase Creditors Report</h2><p>Generated: '+dateStr+'</p></div>                <table class="print-table"><thead><tr><th>#</th><th>Supplier</th><th class="text-right">Total</th><th class="text-right">Cash Paid</th><th class="text-right">Cheque Paid</th><th class="text-right">Balance Due</th><th class="text-right">%</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="2" class="font-bold">GRAND TOTAL ('+creditors.length+')</td><td class="text-right">'+this.fn(totals.total)+'</td><td class="text-right">'+this.fn(totals.cash)+'</td><td class="text-right">'+this.fn(totals.cheque)+'</td><td class="text-right">'+this.fn(totals.balance)+'</td><td class="text-right">100%</td></tr></tfoot></table>';
            this._printHTML(html, 'Purchase Creditors Report');
        },

        printChequesReport() {
            const dateStr = new Date().toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric'});
            const cheques = this.filteredCheques;
            const total = cheques.reduce((a,c)=>a+(+c.amount||0),0);
            const rows = cheques.map(c=>'<tr><td>'+this.fd(c.date)+'</td><td class="font-bold">'+c.chequeNo+'</td><td>'+c.bank+'</td><td>'+c.party+'</td><td class="text-right" style="color:'+(c.type==='received'?'#059669':'#dc2626')+';">'+this.fc(c.amount)+'</td><td>'+c.type+'</td><td>'+c.status+'</td><td>'+(c.clearDate?this.fd(c.clearDate):'-')+'</td><td>'+(c.remark||'')+'</td></tr>').join('');
            const html = '                <div class="print-header"><h1>AM Sales - Pro Accounting v10</h1><h2>Cheque Registry Report</h2><p>Generated: '+dateStr+'</p></div>                <table class="print-table"><thead><tr><th>Date</th><th>Cheque No</th><th>Bank</th><th>Party</th><th class="text-right">Amount</th><th>Type</th><th>Status</th><th>Clear Date</th><th>Remark</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="4" class="font-bold text-right">TOTAL ('+cheques.length+')</td><td class="text-right">'+this.fc(total)+'</td><td colspan="4"></td></tr></tfoot></table>';
            this._printHTML(html, 'Cheque Registry Report');
        },

        _printHTML(html, title) {
            const printWin = window.open('', '_blank', 'width=1000,height=700');
            if (!printWin) { this.toast('Print Error', 'Please allow popups for this site to print reports.', 'error'); return; }
            printWin.document.write('<!DOCTYPE html><html><head><title>' + title + ' - AM Sales Pro v10</title><style>body{font-family:Inter,Arial,sans-serif;padding:20px;font-size:11px;color:#1e293b}.print-header{margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #1d4ed8}.print-header h1{font-size:1.3rem;font-weight:800;margin:0 0 4px;color:#0f172a}.print-header h2{font-size:1rem;font-weight:600;margin:0 0 2px;color:#334155}.print-header p{font-size:0.75rem;color:#64748b;margin:0}.print-table{width:100%;border-collapse:collapse;font-size:9px}.print-table th,.print-table td{padding:4px 6px;border:1px solid #e2e8f0}.print-table thead tr{background:#f1f5f9}.print-table thead th{font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#475569}.print-table tbody tr:nth-child(even){background:#fafafa}.print-table tfoot tr{background:#dbeafe;font-weight:800}.text-right{text-align:right}.text-left{text-align:left}.font-bold{font-weight:700}.text-rose-600{color:#dc2626}@media print{body{padding:0}}</style></head><body>' + html + '<script>setTimeout(function(){window.print();},300);</script></body></html>');
            printWin.document.close();
        },

        // ─── PWA Install Prompt ────────────────────────────────────
        checkForInstallPrompt() {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredInstallPrompt = e;
                this.showInstallPrompt = true;
            });
            window.addEventListener('appinstalled', () => {
                this.showInstallPrompt = false;
                this.toast('Installed', 'AM Sales Pro v10 has been installed on your device.', 'success');
            });
        },

        installPWA() {
            if (this.deferredInstallPrompt) {
                this.deferredInstallPrompt.prompt();
                this.deferredInstallPrompt.userChoice.then((choice) => {
                    if (choice.outcome === 'accepted') {
                        this.toast('Installing', 'Installing the app...', 'info');
                    }
                    this.deferredInstallPrompt = null;
                    this.showInstallPrompt = false;
                });
            }
        },

        // ─── INITIALIZATION ────────────────────────────────────────
        async init() {
            const redirectedView = sessionStorage.getItem('redirectView');
            if (redirectedView) {
                const validViews = ['dashboard','records','entry','purchases','cheques','cashflow','analysis','debtors','financials','master'];
                if (validViews.includes(redirectedView)) { this.view = redirectedView; this.toast('Redirected', 'Navigated to the '+redirectedView+' page.', 'info'); }
                sessionStorage.removeItem('redirectView');
            }

            this.cloudStatus = 'Connecting...'; this.cloudAvailable = false; this.cloudStorage = 'Local'; this.cloudStorageDetails = 'Checking...'; this.apiBase = 'Supabase';
            this.isLoading = true; this.loadingMsg = 'Connecting to database...'; this.progress = 20;
            this.resetSaleForm(); this.resetPurchaseForm(); this.resetExpenseForm(); this.resetChequeForm();

            try {
                const data = await loadDataFromSupabase();
                this.applyCloudData(data);
                this.toast('Connected', 'Data loaded from Supabase.', 'success');
                this.cloudStatus = 'Connected'; this.cloudAvailable = true;
                this.cloudStorage = 'Supabase + Local'; this.cloudStorageDetails = 'Auto-sync enabled';
            } catch (e) {
                this.toast('Connection Error', 'Could not load from Supabase. Using local data. ' + e.message, 'error');
                this.cloudStatus = 'Offline (local only)'; this.cloudAvailable = false;
                console.warn("Supabase load failed, falling back to localStorage.", e);
                try {
                    let raw = localStorage.getItem('am_accounts_v10');
                    if (raw) { const d = JSON.parse(raw); this.applyCloudData(d); this.toast('Offline Mode', 'Data loaded from local.', 'info'); }
                    else {
                        raw = localStorage.getItem('am_accounts_v9');
                        if (raw) { const d = JSON.parse(raw); this.applyCloudData(d); localStorage.removeItem('am_accounts_v9'); this.toast('Migration', 'Data migrated to v10.', 'info'); this.schedulePersist(); }
                    }
                } catch (localError) {
                    this.toast('Fatal Error', 'Could not load data: ' + localError.message, 'error');
                }
            }

            this.progress = 100;
            setTimeout(() => this.updateCharts(), 500);
            setTimeout(() => { this.isLoading = false; }, 300);
            this.checkForInstallPrompt();

            window.addEventListener('beforeunload', () => {
                if (this._persistTimer) { clearTimeout(this._persistTimer); localStorage.setItem('am_accounts_v10', JSON.stringify(this.buildAppData())); }
            });

            // Periodic sync queue processing
            setInterval(() => { this.processSyncQueue(); }, 30000);
        }
    };
}
