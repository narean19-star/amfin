function accountingApp() {
    return {
        // State
        view: 'dashboard',
        isLoading: true,
        loadingMsg: '',
        progress: 0,
        sidebarOpen: false,
        toasts: [],
        showInstallPrompt: false,
        // Notification Center State
        notifications: [],
        showNotificationCenter: false,
        unreadNotificationCount: 0,
        // Modal State
        modal: {
            show: false,
            title: '',
            message: '',
            onConfirm: null,
        },

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
        expenseCategories: ['Rent', 'Salaries', 'Fuel & Transport', 'Electricity', 'Telephone', 'Maintenance', 'Stationery', 'Miscellaneous'],
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

        // Search fields
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

        // New item inputs for master
        newOwnerInput: '',
        newCustInput: '',
        newItemInput: '',
        newCatInput: '',
        newSupplierInput: '',
        newOwnerMode: false,
        newCustMode: false,
        newItemMode: false,

        // AI Assistant state
        aiPrompt: '',
        aiInsight: '',
        isAILoading: false,

        // Charts
        _charts: {},
        _persistTimer: null,

        get viewTitle() {
            const titles = { dashboard: 'Dashboard', records: 'Sales Ledger', entry: 'Sale Entry', purchases: 'Purchases', cheques: 'Cheque Registry', cashflow: 'Expenses & Cashflow', analysis: 'P&L Analysis', debtors: 'Debtors & Creditors', financials: 'Financial Reports', master: 'Master Data' };
            return titles[this.view] || 'AM Sales Pro v10';
        },

        // ─── Formatters ─────────────────────────────────────────────
        fc(v) { return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 }).format(v || 0); },
        fn(v) { if (v === undefined || v === null || v === '' || isNaN(v)) return '0'; return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v); },
        fd(d) { if (!d) return ''; const p = String(d).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; },
        
        // ─── Toasts & Notifications ─────────────────────────────────
        toast(title, msg, type = 'info') {
            const id = Date.now() + Math.random();
            const newToast = { id, title, msg, type, time: new Date() };
            
            // For on-screen toasts
            this.toasts.push(newToast);
            setTimeout(() => this.removeToast(id), 4000);

            // For notification center history
            this.notifications.unshift(newToast);
            if (this.notifications.length > 50) { // Keep only last 50
                this.notifications.pop();
            }
            this.unreadNotificationCount++;
        },
        removeToast(id) { this.toasts = this.toasts.filter(t => t.id !== id); },

        toggleNotificationCenter() {
            this.showNotificationCenter = !this.showNotificationCenter;
            if (this.showNotificationCenter) {
                this.unreadNotificationCount = 0;
            }
        },

        clearNotifications() {
            this.notifications = [];
            this.unreadNotificationCount = 0;
            this.showNotificationCenter = false;
        },

        // ─── Init & Persist ─────────────────────────────────────────
        async init() {
            // Handle deep linking from 404 redirect
            const redirectedView = sessionStorage.getItem('redirectView');
            if (redirectedView) {
                // List of valid views to prevent navigating to a non-existent state
                const validViews = ['dashboard', 'records', 'entry', 'purchases', 'cheques', 'cashflow', 'analysis', 'debtors', 'financials', 'master'];
                if (validViews.includes(redirectedView)) {
                    this.view = redirectedView;
                    this.toast('Redirected', `Navigated to the ${redirectedView} page.`, 'info');
                }
                sessionStorage.removeItem('redirectView'); // Clean up after use
            }

            this.isLoading = true;
            this.loadingMsg = 'Connecting to database...';
            this.progress = 20;
            this.resetSaleForm(); this.resetPurchaseForm(); this.resetExpenseForm(); this.resetChequeForm();

            try {
                const data = await loadDataFromSupabase();
                this.applyCloudData(data);
                this.toast('Connected', 'Data loaded from Supabase.', 'success');
            } catch (e) {
                this.toast('Connection Error', 'Could not load from Supabase. Using local data. ' + e.message, 'error');
                console.warn("Supabase load failed, falling back to localStorage.", e);
                // Fallback to local storage if Supabase fails
                try {
                    let raw = localStorage.getItem('am_accounts_v10');
                    if (raw) {
                        const d = JSON.parse(raw);
                        this.applyCloudData(d);
                        this.toast('Offline Mode', 'Loaded data from local backup.', 'info');
                    } else {
                        // Try migrating from old v9 format
                        raw = localStorage.getItem('am_accounts_v9');
                        if (raw) {
                            const d = JSON.parse(raw);
                            this.applyCloudData(d);
                            localStorage.removeItem('am_accounts_v9'); // Clean up old data after migration
                            this.toast('Migration', 'Data migrated to new version. Please verify.', 'info');
                            this.persist(); // Save the migrated data
                        }
                    }
                } catch (localError) {
                    this.toast('Fatal Error', 'Could not load any data: ' + localError.message, 'error');
                }
            }
            this.progress = 100;
            this.$watch('entries', () => { this.updateCharts(); });
            this.$watch('view', v => { if (v === 'dashboard' || v === 'analysis') setTimeout(() => this.updateCharts(), 80); });
            setTimeout(() => this.updateCharts(), 500);
            setTimeout(() => { this.isLoading = false; }, 300);

            // Check if we should show the iOS install prompt.
            this.checkForInstallPrompt();

            // Add a listener to ensure data is saved to local storage before the user leaves.
            window.addEventListener('beforeunload', () => {
                if (this._persistTimer) {
                    // A save is pending. Cancel the async timer and save synchronously to localStorage.
                    // This is the most reliable way to prevent data loss on tab close.
                    clearTimeout(this._persistTimer);
                    localStorage.setItem('am_accounts_v10', JSON.stringify(this.buildAppData()));
                }
            });
        },

        persist() {
            if (this._persistTimer) clearTimeout(this._persistTimer);
            this._persistTimer = setTimeout(async () => {
                await this.forceSave();
            }, 1000); // Debounce for 1 second
        },

        buildAppData() {
            return {
                entries: this.entries,
                purchases: this.purchases,
                expenses: this.expenses,
                cheques: this.cheques,
                owners: this.owners,
                customers: this.customers,
                items: this.items,
                suppliers: this.suppliers,
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

        async forceSave() {
            if (this._persistTimer) clearTimeout(this._persistTimer);
            const data = this.buildAppData();
            // Always save to local storage as a backup
            localStorage.setItem('am_accounts_v10', JSON.stringify(data));
            
            // Attempt to save to Supabase
            try {
                this.loadingMsg = 'Saving...';
                this.isLoading = true;
                await saveDataToSupabase(data);
                this.toast('Saved', 'Changes saved to the database.', 'success');
            } catch (error) {
                this.toast('Save Error', 'Could not save to Supabase. ' + error.message, 'error');
                console.error("Supabase save failed.", error);
            } finally {
                this.isLoading = false;
            }
        },

        async syncToCloud() {
            this.toast('Syncing...', 'Attempting to force-save all data to the cloud.', 'info');
            await this.forceSave();
        },

        // ─── AI Assistant ───────────────────────────────────────────
        async getAIInsight() {
            if (!this.aiPrompt.trim()) {
                this.toast('AI Assistant', 'Please enter a question.', 'warning');
                return;
            }

            this.isAILoading = true;
            this.aiInsight = ''; // Clear previous insight

            try {
                // Build a smarter, more detailed context for the AI.
                const context = this.buildAIContext();
                
                const fullPrompt = `You are a helpful financial assistant. Based on the following data summary, please answer the user's question. Be concise and clear.

--- Data Summary ---
${context}
--- End of Summary ---

User Question: "${this.aiPrompt}"`;

                const response = await getGroqChatCompletion(fullPrompt);
                this.aiInsight = response;
            } catch (error) {
                console.error('Error getting AI insight:', error);
                this.aiInsight = `Failed to get a response from the AI. ${error.message}`;
                this.toast('AI Error', error.message, 'error');
            } finally {
                this.isAILoading = false;
            }
        },

        buildAIContext() {
            // This helper function builds a context string with key financial metrics.
            // Assumes computed properties like 'totals' and 'summariesByCustomer' are available.
            const summary = {
                period: { from: this.filterFrom || 'start', to: this.filterTo || 'today' },
                sales: { totalRevenue: this.totals.sales, transactionCount: this.entries.length },
                profitability: { grossProfit: this.totals.grossProfit, netProfit: this.totals.netProfit, netMarginPercent: this.totals.sales > 0 ? (this.totals.netProfit / this.totals.sales * 100) : 0 },
                outstandingDebtors: { totalOwed: this.totals.outstanding, count: this.summariesByOutstanding.length },
                topCustomers: this.summariesByCustomer.slice(0, 5).map(c => ({ customer: c.customer, revenue: c.revenue })),
            };
            // Convert the summary object to a string for the prompt.
            return JSON.stringify(summary, null, 2);
        },

        normalizeSaleEntry(e) {
            const numericFields = ['Pkgs', 'P.Kilo', 'G.Kilo', 'Tare', 'N.Kilo', 'Rate', 'Kooli', 'C.Amount', 'A.Amount', 'Cash', 'Cheque', 'Credit Given', 'Credit Received', 'Balance'];
            const entry = { ...e };
            numericFields.forEach(field => {
                entry[field] = parseFloat(entry[field]) || 0;
            });
            // Ensure ID exists for upsert
            if (!entry.id) {
                // A simple UUID generator. Supabase will generate one if it's null on insert, but it's good practice for client-side operations.
                entry.id = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
            }
            return entry;
        },

        autoCategorizeExpense() {
            if (this.expenseForm.category && this.expenseForm.category.trim() !== '') {
                return; // Don't overwrite if a category is already set
            }
            const description = (this.expenseForm.description || '').toLowerCase();
            if (!description) return;

            for (const category in this.expenseCategoryKeywords) {
                for (const keyword of this.expenseCategoryKeywords[category]) {
                    if (description.includes(keyword)) {
                        this.expenseForm.category = category;
                        this.toast('Auto-Categorized', `Set category to "${category}"`, 'info');
                        return; // Stop after first match
                    }
                }
            }
        },

        // ─── Data Management ────────────────────────────────────────
        backupJSON() {
            const data = this.buildAppData();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `amfin_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.toast('Backup Complete', 'A local JSON backup has been downloaded.', 'success');
        },

        importJSON(event) {
            const file = event.target.files[0];
            if (!file) {
                this.toast('No file selected', 'Please select a JSON backup file to import.', 'warning');
                return;
            }

            this.isLoading = true;
            this.loadingMsg = 'Importing JSON backup...';

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    // Basic validation to see if it looks like our data
                    if (!data.entries && !data.owners) {
                        throw new Error('JSON file does not appear to be a valid backup.');
                    }

                    this.showModal(
                        'Confirm Import',
                        'This will overwrite ALL local and cloud data with the backup. This cannot be undone. Are you sure?',
                        () => {
                            this.applyCloudData(data);
                            this.toast('Import Complete', 'Data has been restored from the JSON backup. Saving to cloud...', 'success');
                            this.forceSave(); // Immediately save the restored data to Supabase
                        },
                        () => {
                        this.toast('Import Cancelled', 'The import operation was cancelled.', 'info');
                        this.isLoading = false;
                        this.loadingMsg = '';
                        event.target.value = '';
                        return;
                    }

                } catch (error) {
                    console.error("Error importing JSON file:", error);
                    this.toast('Import Error', `Failed to process the JSON file. ${error.message}`, 'error');
                    this.isLoading = false;
                } finally {
                    event.target.value = ''; // Reset file input
                }
            };

            reader.onerror = (error) => {
                console.error("FileReader error:", error);
                this.toast('File Read Error', 'Could not read the selected file.', 'error');
                this.isLoading = false;
                this.loadingMsg = '';
                event.target.value = '';
            };

            reader.readAsText(file);
        },

        importExcel(event) {
            const file = event.target.files[0];
            if (!file) {
                this.toast('No file selected', 'Please select an Excel file to import.', 'warning');
                return;
            }

            this.isLoading = true;
            this.loadingMsg = 'Importing Excel data...';
            this.progress = 0;

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    this.progress = 10;

                    const processSheet = (sheetName, dataArrayName, normalizer) => {
                        const sheet = workbook.Sheets[sheetName];
                        if (!sheet) return;

                        let jsonData = XLSX.utils.sheet_to_json(sheet);
                        
                        jsonData = jsonData.map(row => {
                            const newRow = { ...row };
                            // Convert Excel date to YYYY-MM-DD string for all relevant date fields
                            ['Date', 'date', 'clearDate'].forEach(dateField => {
                                if (newRow[dateField] && newRow[dateField] instanceof Date) {
                                    const d = newRow[dateField];
                                    const y = d.getFullYear();
                                    const m = String(d.getMonth() + 1).padStart(2, '0');
                                    const day = String(d.getDate()).padStart(2, '0');
                                    newRow[dateField] = `${y}-${m}-${d}`;
                                }
                            });

                            return normalizer ? normalizer(newRow) : newRow;
                        });

                        // Replace the data for the given sheet completely.
                        this[dataArrayName] = jsonData;
                        this.toast(`Data Replaced`, `Loaded ${jsonData.length} records from "${sheetName}", replacing previous data.`, 'success');
                    };

                    processSheet('Sales', 'entries', this.normalizeSaleEntry.bind(this));
                    this.progress = 40;
                    processSheet('Purchases', 'purchases');
                    this.progress = 60;
                    processSheet('Expenses', 'expenses');
                    this.progress = 80;
                    processSheet('Cheques', 'cheques');
                    this.progress = 90;

                    this.toast('Import Complete', 'Excel data has been processed.', 'success');
                    this.updateMastersFromData();
                    this.persist();

                } catch (error) {
                    console.error("Error importing Excel file:", error);
                    this.toast('Import Error', `Failed to process the Excel file. ${error.message}`, 'error');
                } finally {
                    this.progress = 100;
                    setTimeout(() => { this.isLoading = false; this.loadingMsg = ''; }, 500);
                    event.target.value = ''; // Reset file input
                }
            };

            reader.onerror = (error) => {
                console.error("FileReader error:", error);
                this.toast('File Read Error', 'Could not read the selected file.', 'error');
                this.isLoading = false;
                this.loadingMsg = '';
                event.target.value = '';
            };

            reader.readAsArrayBuffer(file);
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
            
            this.toast('Master Data Updated', 'Dropdown lists have been updated from imported data.', 'info');
        },

        exportExcel() {
            this.isLoading = true;
            this.loadingMsg = 'Generating Excel file...';
            try {
                const wb = XLSX.utils.book_new();

                // Add data sheets
                if (this.entries.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.entries), 'Sales');
                if (this.purchases.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.purchases), 'Purchases');
                if (this.expenses.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.expenses), 'Expenses');
                if (this.cheques.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.cheques), 'Cheques');
                
                // Add master data sheets
                if (this.owners.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.owners.map(o => ({ Owner: o }))), 'Owners');
                if (this.customers.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.customers.map(c => ({ Customer: c }))), 'Customers');
                if (this.items.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.items.map(i => ({ Item: i }))), 'Items');
                if (this.suppliers.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(this.suppliers.map(s => ({ Supplier: s }))), 'Suppliers');

                XLSX.writeFile(wb, `amfin_export_${new Date().toISOString().split('T')[0]}.xlsx`);
                this.toast('Export Complete', 'Excel file has been downloaded.', 'success');
            } catch (error) {
                console.error("Error exporting to Excel:", error);
                this.toast('Export Error', `Could not generate Excel file. ${error.message}`, 'error');
            } finally {
                this.isLoading = false;
            }
        },

        async clearAllData() {
            this.showModal(
                'Confirm Delete All Data',
                'This will permanently delete ALL data from the local device and the cloud database. This action cannot be undone.',
                async () => {
                    this.isLoading = true;
                    this.loadingMsg = 'Deleting all cloud data...';
                    try {
                        await clearAllSupabaseData();
                        this.toast('Success', 'All cloud data has been deleted. The app will now reload.', 'success');
                        localStorage.removeItem('am_accounts_v10');
                        localStorage.removeItem('am_accounts_v9');
                        setTimeout(() => location.reload(), 2000);
                    } catch (error) {
                        this.toast('Error', 'Could not clear cloud data. ' + error.message, 'error');
                        this.isLoading = false;
                    }
                },
                () => {
                    this.toast('Cancelled', 'Clear data operation was cancelled.', 'info');
                }
            );
        },

        showModal(title, message, onConfirm, onCancel = null) {
            this.modal.title = title;
            this.modal.message = message;
            this.modal.onConfirm = onConfirm;
            this.modal.onCancel = onCancel;
            this.modal.show = true;
        },

        closeModal() {
            if (this.modal.onCancel) this.modal.onCancel();
            this.modal.show = false;
        },

        findBill() {
            if (!this.billSearch.trim()) {
                this.foundBill = null;
                return;
            }
            const billNo = this.billSearch.trim();
            this.foundBill = this.entries.find(e => String(e['Bill No']) === billNo) || null;
        },

        loadBillIntoForm(bill) {
            this.saleForm = JSON.parse(JSON.stringify(bill)); // Deep copy to avoid modifying original
            this.setView('entry');
            this.toast('Entry Loaded', `Bill #${bill['Bill No']} loaded into the form for editing.`, 'info');
            this.foundBill = null;
            this.billSearch = '';
        },

        // --- PRINTING ---
        printDetailedReport(type, filter = '', onlyOutstanding = false) {
            let records, title, totals;
            const dateRange = this.filterFrom && this.filterTo ? `from ${this.fd(this.filterFrom)} to ${this.fd(this.filterTo)}` : 'for all dates';

            switch (type) {
                case 'Owner':
                    records = this.ownerFilteredRecords;
                    totals = this.ownerFilteredRecordsTotals;
                    title = `Detailed Report for Owner: ${filter || 'All'} ${dateRange}`;
                    break;
                case 'Customer':
                    records = this.customerFilteredRecords;
                    totals = this.customerFilteredRecordsTotals;
                    title = `Detailed Report for Customer: ${filter || 'All'} ${dateRange}`;
                    break;
                case 'all':
                    records = this.filteredSalesRecords;
                    totals = this.filteredSalesRecords.reduce((acc, e) => {
                        acc.nKilo += +e['N.Kilo'] || 0;
                        acc.cAmount += +e['C.Amount'] || 0;
                        acc.aAmount += +e['A.Amount'] || 0;
                        acc.cash += +e.Cash || 0;
                        acc.cheque += +e.Cheque || 0;
                        acc.balance += +e.Balance || 0;
                        return acc;
                    }, { nKilo: 0, cAmount: 0, aAmount: 0, cash: 0, cheque: 0, balance: 0 });
                    title = `Full Sales Ledger ${dateRange}`;
                    break;
                default:
                    this.toast('Not Implemented', `Printing for type "${type}" is not yet available.`, 'warning');
                    return;
            }

            if (onlyOutstanding) {
                records = records.filter(e => e.Balance > 0);
                title = `Outstanding Report for ${filter || 'All'} ${dateRange}`;
            }

            if (!records || records.length === 0) {
                this.toast('No Data', 'There is no data to print for the selected criteria.', 'info');
                return;
            }

            const printContent = `
                <div style="margin-bottom: 20px; text-align: center;">
                    <h1 style="font-size: 1.5rem; font-weight: bold;">AM Sales</h1>
                    <h2 style="font-size: 1.1rem; color: #333;">${title}</h2>
                    <p style="font-size: 0.9rem; color: #555;">Generated on: ${new Date().toLocaleString()}</p>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
                    <thead><tr style="background-color: #f2f2f2;">
                        ${['Date', 'Bill#', 'Owner', 'Customer', 'Item', 'N.KG', 'Rate', 'C.Amt', 'A.Amt', 'Cash', 'Cheque', 'Balance'].map(h => `<th style="padding: 4px; border: 1px solid #ddd; text-align: ${['N.KG','Rate','C.Amt','A.Amt','Cash','Cheque','Balance'].includes(h) ? 'right' : 'left'};">${h}</th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${records.map(e => `<tr>
                            ${[this.fd(e.Date), e['Bill No'], e.Owner, e.Customer, e.Item, this.fn(e['N.Kilo']), this.fn(e.Rate), this.fn(e['C.Amount']), this.fn(e['A.Amount']), this.fn(e.Cash), this.fn(e.Cheque), this.fn(e.Balance)].map((val, i) => `<td style="padding: 4px; border: 1px solid #ddd; text-align: ${i > 4 ? 'right' : 'left'};">${val}</td>`).join('')}
                        </tr>`).join('')}
                    </tbody>
                    <tfoot><tr style="font-weight: bold; background-color: #f2f2f2;">
                        <td colspan="5" style="padding: 4px; border: 1px solid #ddd; text-align: right;">TOTALS</td>
                        <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${this.fn(totals.nKilo)}</td><td></td>
                        <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${this.fc(totals.cAmount)}</td><td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${this.fc(totals.aAmount)}</td>
                        <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${this.fc(totals.cash)}</td><td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${this.fc(totals.cheque)}</td>
                        <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${this.fc(totals.balance)}</td>
                    </tr></tfoot>
                </table>`;
            
            this.triggerPrint(title, printContent);
        },

        triggerPrint(title, content) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`<html><head><title>${title}</title><style>body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } @media print { @page { size: A4 landscape; margin: 0.5in; } body { -webkit-print-color-adjust: exact; } }</style></head><body>${content}</body></html>`);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
        },

        // Stubs for other print functions
        printCompactReport(type, filter, onlyOutstanding = false) { this.toast('Not Implemented', 'Compact reports are not yet available for printing.', 'warning'); },
        printSummaryTable(type, summaries, grandTotal) { this.toast('Not Implemented', 'Summary reports are not yet available for printing.', 'warning'); },
        printPLReport() { this.toast('Not Implemented', 'P&L reports are not yet available for printing.', 'warning'); },
        printOutstandingReport(filter) { this.printDetailedReport('Owner', filter, true); },
        printPurchasesReport() { this.toast('Not Implemented', 'Purchases reports are not yet available for printing.', 'warning'); },
        printChequesReport() { this.toast('Not Implemented', 'Cheque reports are not yet available for printing.', 'warning'); },
        printExpensesReport() { this.toast('Not Implemented', 'Expense reports are not yet available for printing.', 'warning'); },
        printInvoice(entry) { this.toast('Not Implemented', 'Invoice PDF generation is not yet available.', 'warning'); },

        // ─── PWA Install Prompt for iOS ─────────────────────────────
        checkForInstallPrompt() {
            const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
            // The 'standalone' property is a non-standard API supported by Mobile Safari.
            const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);
            const hasDismissed = localStorage.getItem('amfin_install_prompt_dismissed') === 'true';

            if (isIOS && !isInStandaloneMode && !hasDismissed) {
                this.showInstallPrompt = true;
            }
        },

        dismissInstallPrompt() {
            this.showInstallPrompt = false;
            localStorage.setItem('amfin_install_prompt_dismissed', 'true');
            this.toast('Prompt Dismissed', 'You can still add this app via the share menu.', 'info');
        },
    };
}