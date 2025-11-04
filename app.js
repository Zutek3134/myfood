document.addEventListener('DOMContentLoaded', () => {
    class AutoComplete {
        constructor(config) {
            this.config = {
                inputElement: null,
                suggestionsContainer: null,
                dataSource: () => [],
                filterKey: 'name',
                displayTemplate: (item) => item.name,
                onSelect: () => { },
                debounceDelay: 50,
                ...config
            };

            this.clickOutsideHandler = this.handleClickOutside.bind(this);

            this.init();
        }

        init() {
            const { inputElement, suggestionsContainer } = this.config;
            if (!inputElement || !suggestionsContainer) {
                console.warn('ACS 初始化失敗：缺少輸入框或建議容器');
                return;
            }

            inputElement.autoCompleteInstance = this;

            const handleInput = this.debounce((e) => {
                const value = e.target.value;
                this.filterAndRender(value);
            }, this.config.debounceDelay);

            inputElement.addEventListener('input', handleInput);
            inputElement.addEventListener('focus', () => {
                this.filterAndRender(inputElement.value);
            });

            suggestionsContainer.addEventListener('click', (e) => {
                const item = e.target.closest('.auto-complete-suggestion');
                if (item) {
                    const value = item.dataset.value;
                    inputElement.value = value;
                    this.hideSuggestions();
                    this.config.onSelect(value, item.dataset);
                }
            });

            inputElement.addEventListener('keydown', (e) => this.handleKeyboard(e));

            this.addClickOutsideListener();
        }

        addClickOutsideListener() {
            document.addEventListener('click', this.clickOutsideHandler, true);
        }

        handleClickOutside(event) {
            const { inputElement, suggestionsContainer } = this.config;

            const isClickInsideInput = inputElement.contains(event.target);
            const isClickInsideSuggestions = suggestionsContainer.contains(event.target);

            if (!isClickInsideInput && !isClickInsideSuggestions) {
                this.hideSuggestions();
            }
        }

        filterAndRender(keyword) {
            const { dataSource, filterKey, suggestionsContainer, displayTemplate } = this.config;
            const sourceData = dataSource();
            const trimmedKeyword = keyword.trim().toLowerCase();

            const filtered = trimmedKeyword
                ? sourceData.filter(item =>
                    item[filterKey]?.toLowerCase().includes(trimmedKeyword)
                )
                : sourceData.slice(0, 5);

            if (filtered.length === 0) {
                this.hideSuggestions();
                return;
            }

            suggestionsContainer.innerHTML = filtered.map(item => `
            <div class="auto-complete-suggestion" 
                 data-value="${item[filterKey]}"
                 data-${filterKey}="${item[filterKey]}">
                ${displayTemplate(item)}
            </div>
        `).join('');
            this.showSuggestions();
        }

        showSuggestions() {
            this.config.suggestionsContainer.classList.add('show');
            this.config.suggestionsContainer.style.zIndex = '1000';
        }

        hideSuggestions() {
            this.config.suggestionsContainer.classList.remove('show');
        }

        handleKeyboard(e) {
            const { suggestionsContainer, inputElement } = this.config;
            const suggestions = suggestionsContainer.querySelectorAll('.auto-complete-suggestion');
            if (suggestions.length === 0) return;

            let activeIndex = Array.from(suggestions).findIndex(s => s.classList.contains('active'));

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    activeIndex = activeIndex < suggestions.length - 1 ? activeIndex + 1 : 0;
                    this.setActiveSuggestion(suggestions, activeIndex);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    activeIndex = activeIndex > 0 ? activeIndex - 1 : suggestions.length - 1;
                    this.setActiveSuggestion(suggestions, activeIndex);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (activeIndex !== -1) suggestions[activeIndex].click();
                    break;
                case 'Escape':
                    this.hideSuggestions();
                    break;
            }
        }

        setActiveSuggestion(suggestions, index) {
            suggestions.forEach(s => s.classList.remove('active'));
            suggestions[index].classList.add('active');
            suggestions[index].scrollIntoView({ block: 'nearest' });
        }

        debounce(func, delay) {
            let timer;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => func.apply(this, args), delay);
            };
        }

        destroy() {
            const { inputElement } = this.config;
            if (inputElement) {
                inputElement.removeEventListener('input', this.handleInput);
                inputElement.removeEventListener('focus', this.handleFocus);
                inputElement.removeEventListener('keydown', this.handleKeyboard);
                delete inputElement.autoCompleteInstance;
            }

            document.removeEventListener('click', this.clickOutsideHandler, true);
        }
    }

    class PanelManager {
        constructor() {
            this.currentOpenPanels = [];
            this.elements = {
                panelBackdrop: document.getElementById('panel-backdrop')
            };

            this.handleHashChange = (e) => {
                const hasPanelHash = e.newURL.includes('#panel-');
                if (this.currentOpenPanels.length > 0 && !hasPanelHash) {
                    e.preventDefault();
                    this.closeLastOpenPanel();
                }
            };

            this.handleEscapeKey = (e) => {
                if (e.key === 'Escape' && this.currentOpenPanels.length > 0) {
                    e.preventDefault();
                    this.closeLastOpenPanel();
                }
            };

            window.addEventListener('hashchange', this.handleHashChange, true);
            document.addEventListener('keydown', this.handleEscapeKey, true);
        }

        openPanel(panelId) {
            const panel = document.getElementById(panelId);
            if (!panel || !this.elements.panelBackdrop || this.currentOpenPanels.includes(panelId)) {
                return;
            }

            panel.classList.add('show');
            panel.scrollTop = 0;
            this.elements.panelBackdrop.classList.add('show');
            document.body.style.overflow = 'hidden';
            this.currentOpenPanels.push(panelId);

            const uniqueHash = `#${new Date().getTime().toString().slice(5)}`;
            const newUrl = window.location.href.split('#')[0] + uniqueHash;

            history.pushState({ panelId }, '', newUrl);
            // location.hash = uniqueHash;
        }

        closePanel(panelId) {
            const panel = document.getElementById(panelId);
            if (!panel || !this.elements.panelBackdrop) return;

            panel.classList.remove('show');
            this.currentOpenPanels = this.currentOpenPanels.filter(id => id !== panelId);

            if (this.currentOpenPanels.length === 0) {
                this.elements.panelBackdrop.classList.remove('show');
                document.body.style.overflow = '';

                const originalUrl = window.location.href.split('#')[0];
                history.replaceState(null, '', originalUrl);
            } else {
                this.elements.panelBackdrop.classList.add('show');
            }
        }

        closeLastOpenPanel() {
            const lastPanelId = this.currentOpenPanels.at(-1);
            if (lastPanelId) {
                this.closePanel(lastPanelId);
            }
        }

        closeAllPanels() {
            this.currentOpenPanels.forEach(panelId => this.closePanel(panelId));
        }

        destroy() {
            window.removeEventListener('hashchange', this.handleHashChange, true);
            document.removeEventListener('keydown', this.handleEscapeKey, true);
        }
    }

    class FoodDiaryApp {
        constructor() {
            this.STORAGE_KEYS = {
                MEALS: 'foodDiaryMeals',
                RESTAURANTS: 'foodDiaryRestaurants',
                POPULAR_ITEMS: 'foodDiaryPopularItems'
            };

            this.state = {
                meals: [],
                filteredMeals: [],
                restaurants: [],
                popularItems: {},
                editingRestaurantId: null,
                currentMealId: null,
                currentImageData: null,
                currentRestaurantName: '',
                tempMenuItem: null,
                tempMenuItems: []
            };

            this.elements = this.cacheDomElements();
            this.autoCompleteInstances = {};
            this.debounceTimers = {};
            this.panelInstance = new PanelManager();

            this.init();
        }

        cacheDomElements() {
            return {
                // 收藏餐廳ACS元素
                frequentRestaurantName: document.getElementById('frequent-restaurant-name'),
                frequentRestaurantSuggestions: document.getElementById('frequent-restaurant-suggestions'),
                frequentRestaurantBranch: document.getElementById('frequent-restaurant-branch'),
                frequentBranchSuggestions: document.getElementById('frequent-branch-suggestions'),

                // 用餐紀錄ACS元素
                restaurantName: document.getElementById('restaurant-name'),
                restaurantSuggestions: document.getElementById('restaurant-suggestions'),
                restaurantBranch: document.getElementById('restaurant-branch'),
                branchSuggestions: document.getElementById('branch-suggestions'),

                // 其他元素
                mealList: document.getElementById('meal-list'),
                emptyState: document.getElementById('empty-state'),
                restaurantList: document.getElementById('restaurant-list'),
                menuRecommendationsList: document.getElementById('menu-recommendations-list'),
                frequentRestaurantMenuRecList: document.getElementById('frequent-restaurant-menu-rec-list'),
                addMealForm: document.getElementById('add-meal-form'),
                frequentRestaurantForm: document.getElementById('frequent-restaurant-form'),
                menuItemsList: document.getElementById('menu-items-list'),
                mealDate: document.getElementById('meal-date'),
                menuTotalAmount: document.getElementById('menu-total-amount'),
                editMealId: document.getElementById('edit-meal-id'),
                frequentRestaurantAddress: document.getElementById('frequent-restaurant-address'),
                frequentRestaurantNotes: document.getElementById('frequent-restaurant-notes'),
                frequentRestaurantFormTitle: document.getElementById('frequent-restaurant-form-title'),
                restaurantId: document.getElementById('restaurant-id'),
                imagePreview: document.getElementById('image-preview'),
                mealImageUpload: document.getElementById('meal-image-upload'),
                imageUrl: document.getElementById('image-url'),
                frequentRestaurantMenuItems: document.getElementById('frequent-restaurant-menu-items'),
                addMealPanel: document.getElementById('add-meal-panel'),
                detailPanel: document.getElementById('detail-panel'),
                frequentRestaurantPanel: document.getElementById('frequent-restaurant-panel'),
                panelBackdrop: document.getElementById('panel-backdrop'),
                fabMainButton: document.getElementById('fab-main-button'),
                formClose: document.getElementById('form-close'),
                formCancelBtn: document.getElementById('form-cancel-btn'),
                detailClose: document.getElementById('detail-close'),
                detailCopyBtn: document.getElementById('detail-copy-btn'),
                detailEditBtn: document.getElementById('detail-edit-btn'),
                detailDeleteBtn: document.getElementById('detail-delete-btn'),
                filterToggle: document.getElementById('filter-toggle'),
                filterButton: document.getElementById('filter-button'),
                resetFilter: document.getElementById('reset-filter'),
                clearAll: document.getElementById('clear-all'),
                addMenuItemBtn: document.getElementById('add-menu-item-btn'),
                restaurantManager: document.getElementById('restaurant-manager'),
                addRestaurantBtn: document.getElementById('add-restaurant-btn'),
                frequentRestaurantClose: document.getElementById('frequent-restaurant-close'),
                frequentRestaurantFormCancel: document.getElementById('frequent-restaurant-form-cancel'),
                loadImageUrl: document.getElementById('load-image-url'),
                convertDriveUrl: document.getElementById('convert-drive-url'),
                addRestaurantMenuBtn: document.getElementById('add-restaurant-menu-btn'),
                restaurantFilterContainer: document.getElementById('restaurant-filter-container'),
                detailImg: document.getElementById('detail-img'),
                detailTitle: document.getElementById('detail-title'),
                detailDate: document.getElementById('detail-date'),
                detailCost: document.getElementById('detail-cost'),
                detailMenuItems: document.getElementById('detail-menu-items'),
                startDate: document.getElementById('start-date'),
                endDate: document.getElementById('end-date'),
                formTitle: document.getElementById('form-title'),

                // 匯出匯入元素
                exportDataBtn: document.getElementById('export-data'),
                importDataBtn: document.getElementById('import-data'),
                importFileInput: document.getElementById('import-file')
            };
        }

        init() {
            this.loadData();
            this.initAutoComplete();
            this.initCustomSelects();
            this.updateCustomSelectOptions();
            this.renderMeals();
            this.renderRestaurants();
            this.updatePopularItemsFromMeals();
            this.initDataManagement(); // 初始化匯出匯入功能

            this.elements.mealDate.value = this.getLocalYMD();
            this.calculateMenuTotal();
            this.bindEvents();
        }

        // 改用壓縮方式載入資料
        loadData() {
            this.state.meals = this.loadFromStorageWithCompression(this.STORAGE_KEYS.MEALS, []);
            this.sortMealsByDate(); // 加載後立即排序

            this.state.restaurants = this.loadFromStorageWithCompression(this.STORAGE_KEYS.RESTAURANTS, []);
            this.state.popularItems = this.loadFromStorageWithCompression(this.STORAGE_KEYS.POPULAR_ITEMS, {});

            this.state.filteredMeals = [...this.state.meals];
            this.sortMealsByDate(); // 過濾列表也同步排序
        }

        // 新增：壓縮並儲存到localStorage
        saveToStorageWithCompression(key, data) {
            try {
                const jsonString = JSON.stringify(data);
                const compressed = pako.gzip(jsonString); // 壓縮為二進位
                const base64Str = btoa(String.fromCharCode.apply(null, compressed)); // 轉為Base64字串
                localStorage.setItem(key, base64Str);
                return true;
            } catch (error) {
                console.error('壓縮儲存失敗：', error);
                return false;
            }
        }

        // 新增：從localStorage讀取並解壓縮
        loadFromStorageWithCompression(key, defaultValue) {
            try {
                const base64Str = localStorage.getItem(key);
                if (!base64Str) return defaultValue;

                // Base64轉回二進位
                const compressed = new Uint8Array(
                    atob(base64Str).split('').map(char => char.charCodeAt(0))
                );
                const jsonString = pako.ungzip(compressed, { to: 'string' }); // 解壓縮為字串
                return JSON.parse(jsonString);
            } catch (error) {
                console.error('解壓縮讀取失敗：', error);
                return defaultValue;
            }
        }

        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        }

        formatDate(dateString) {
            const options = { year: 'numeric', month: 'numeric', day: '2-digit', weekday: 'short' };
            const newDate = new Date(dateString).toLocaleDateString('zh-TW', options).split('/');
            newDate[0] -= 1911;
            return newDate.join('-');
        }

        getLocalYMD() {
            let date = new Date();
            let tzo = -date.getTimezoneOffset();

            if (tzo === 0) {
                return date.toISOString();
            } else {
                let pad = function (num, digits = 2) {
                    return String(num).padStart(digits, "0");
                };

                return date.getFullYear() +
                    '-' + pad(date.getMonth() + 1) +
                    '-' + pad(date.getDate());
            }
        }

        getRandomColor() {
            const letters = '0123456789ABCDEF';
            let color = '';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        }

        showToast(message) {
            const toast = document.createElement('div');
            toast.className = 'toast-notification';
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.classList.add('show'), 10);
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        debounce(func, timerKey, delay = 150) {
            return (...args) => {
                if (this.debounceTimers[timerKey]) {
                    clearTimeout(this.debounceTimers[timerKey]);
                }
                this.debounceTimers[timerKey] = setTimeout(() => {
                    func.apply(this, args);
                }, delay);
            };
        }

        initAutoComplete() {
            const getFavoritesSet = () => {
                return new Set(this.state.restaurants.map(restaurant => restaurant.name.trim()));
            };

            const mealRestaurantDataSource = () => {
                const counts = {};
                const scores = {};
                const favorites = getFavoritesSet();

                this.state.restaurants.forEach(restaurant => {
                    const name = restaurant.name.trim();
                    scores[name] = (scores[name] || 0) + 2;
                });

                this.state.meals.forEach(meal => {
                    const name = meal.restaurant.trim();
                    scores[name] = (scores[name] || 0) + 1;
                    counts[name] = (counts[name] || 0) + 1;
                });

                return Object.entries(scores)
                    .map(([name, score]) => ({
                        name: name,
                        count: counts[name],
                        score: score,
                        isFavorite: favorites.has(name)
                    }))
                    .sort((a, b) => b.score - a.score);
            };

            const frequentRestaurantDataSource = () => {
                const counts = {};
                const favorites = getFavoritesSet();

                this.state.meals.forEach(meal => {
                    const name = meal.restaurant.trim();
                    if (!favorites.has(name)) {
                        counts[name] = (counts[name] || 0) + 1;
                    }
                });

                return Object.entries(counts)
                    .map(([name, count]) => ({
                        name: name,
                        count: count,
                        isFavorite: false
                    }))
                    .sort((a, b) => b.count - a.count);
            };

            const getBranchDataSource = (restaurantInputElem) => () => {
                const restaurantName = restaurantInputElem?.value.trim() || '';
                if (!restaurantName) return [];

                const counts = {};
                const scores = {};

                this.state.restaurants
                    .filter(restaurant => restaurant.name.trim() === restaurantName.trim())
                    .forEach(restaurant => {
                        const branch = restaurant.branch?.trim();
                        if (branch) {
                            scores[branch] = (scores[branch] || 0) + 2;
                        }
                    });

                this.state.meals
                    .filter(meal => meal.restaurant.trim() === restaurantName.trim())
                    .forEach(meal => {
                        const branch = meal.branch?.trim();
                        if (branch) {
                            counts[branch] = (counts[branch] || 0) + 1;
                            scores[branch] = (scores[branch] || 0) + 1;
                        }
                    });

                return Object.entries(scores)
                    .map(([branch, score]) => ({
                        branch: branch,
                        count: counts[branch],
                        score: score,
                    }))
                    .sort((a, b) => b.score - a.score);
            };

            if (this.elements.restaurantName && this.elements.restaurantSuggestions) {
                this.autoCompleteInstances.mealRestaurant = new AutoComplete({
                    inputElement: this.elements.restaurantName,
                    suggestionsContainer: this.elements.restaurantSuggestions,
                    dataSource: mealRestaurantDataSource,
                    filterKey: 'name',
                    displayTemplate: (item) => `
                ${item.name}
                ${item.isFavorite ? '<span class="favorite-badge">收藏</span>' : ''}
                <span class="count-badge">${item.count} 次</span>
            `,
                    onSelect: (selectedName) => {
                        this.elements.restaurantBranch?.autoCompleteInstance?.filterAndRender('');
                        this.renderMenuRecommendations(selectedName);
                    }
                });

            }

            if (this.elements.restaurantBranch && this.elements.branchSuggestions) {
                this.autoCompleteInstances.mealBranch = new AutoComplete({
                    inputElement: this.elements.restaurantBranch,
                    suggestionsContainer: this.elements.branchSuggestions,
                    dataSource: getBranchDataSource(this.elements.restaurantName),
                    filterKey: 'branch',
                    displayTemplate: (item) => `
                ${item.branch}
                <span class="count-badge">${item.count} 次</span>
            `
                });
            }

            if (this.elements.frequentRestaurantName && this.elements.frequentRestaurantSuggestions) {
                this.autoCompleteInstances.frequentRestaurant = new AutoComplete({
                    inputElement: this.elements.frequentRestaurantName,
                    suggestionsContainer: this.elements.frequentRestaurantSuggestions,
                    dataSource: frequentRestaurantDataSource,
                    filterKey: 'name',
                    displayTemplate: (item) => `
                ${item.name}
                <span class="count-badge">${item.count} 次</span>
            `,
                    onSelect: (selectedName) => {
                        this.state.currentRestaurantName = selectedName;
                        this.elements.frequentRestaurantBranch?.autoCompleteInstance?.filterAndRender('');
                        this.updateRestaurantMenuRecommendations(selectedName);
                    }
                });
            } else {
                console.error('收藏餐廳名ACS元素不存在！');
            }

            if (this.elements.frequentRestaurantBranch && this.elements.frequentBranchSuggestions) {
                this.autoCompleteInstances.frequentBranch = new AutoComplete({
                    inputElement: this.elements.frequentRestaurantBranch,
                    suggestionsContainer: this.elements.frequentBranchSuggestions,
                    dataSource: getBranchDataSource(this.elements.frequentRestaurantName),
                    filterKey: 'branch',
                    displayTemplate: (item) => `
                ${item.branch}
                <span class="count-badge">${item.count} 次</span>
            `
                });
            } else {
                console.error('收藏餐廳分店ACS元素不存在！');
            }
        }

        getRestaurantSuggestions() {
            const counts = {};
            const favorites = new Set(this.state.restaurants.map(r => r.name.trim()));

            this.state.restaurants.forEach(rest => {
                const name = rest.name.trim();
                counts[name] = (counts[name] || 0) + 2;
            });

            this.state.meals.forEach(meal => {
                const name = meal.restaurant.trim();
                counts[name] = (counts[name] || 0) + 1;
            });

            return Object.entries(counts)
                .map(([name, count]) => ({ name, count, isFavorite: favorites.has(name) }))
                .sort((a, b) => b.count - a.count);
        }

        getBranchSuggestions(restaurantName) {
            if (!restaurantName) return [];

            const counts = {};

            this.state.restaurants
                .filter(rest => rest.name.trim() === restaurantName.trim())
                .forEach(rest => {
                    const branch = rest.branch?.trim();
                    if (branch) counts[branch] = (counts[branch] || 0) + 2;
                });

            this.state.meals
                .filter(meal => meal.restaurant.trim() === restaurantName.trim())
                .forEach(meal => {
                    const branch = meal.branch?.trim();
                    if (branch) counts[branch] = (counts[branch] || 0) + 1;
                });

            return Object.entries(counts)
                .map(([branch, count]) => ({ branch, count }))
                .sort((a, b) => b.count - a.count);
        }

        initCustomSelects() {
            document.querySelectorAll('.custom-select').forEach(container => {
                const trigger = container.querySelector('.select-trigger');
                const options = container.querySelector('.select-options');

                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.custom-select')
                        .forEach(c => c !== container && c.classList.remove('open'));
                    container.classList.toggle('open');
                });

                options.addEventListener('click', (e) => {
                    const option = e.target.closest('.select-option');
                    if (!option) return;

                    const { value, textContent: text } = option;
                    trigger.querySelector('span:first-child').textContent = text;
                    options.querySelectorAll('.select-option').forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    container.classList.remove('open');

                    container.dispatchEvent(new CustomEvent('change', { detail: { value, text } }));
                });
            });

            document.addEventListener('click', () => {
                document.querySelectorAll('.custom-select').forEach(container => container.classList.remove('open'));
            });
        }

        updateCustomSelectOptions() {
            const filterOptions = this.elements.restaurantFilterContainer?.querySelector('.select-options');
            if (!filterOptions) return;

            filterOptions.innerHTML = '';
            const filterFragment = document.createDocumentFragment();
            filterFragment.appendChild(this.createSelectOption('', '所有餐廳', false, true));

            const allRestaurants = new Set([
                ...this.state.restaurants.map(r => r.name),
                ...this.state.meals.map(m => m.restaurant)
            ]);

            Array.from(allRestaurants).sort().forEach(name => {
                filterFragment.appendChild(this.createSelectOption(name, name));
            });
            filterOptions.appendChild(filterFragment);
        }

        createSelectOption(value, text, isDisabled = false, isSelected = false) {
            const option = document.createElement('div');
            option.className = `select-option ${isSelected ? 'selected' : ''}`;
            option.dataset.value = value;
            option.textContent = text;

            if (isDisabled) {
                option.style.color = 'var(--md-sys-color-on-surface-variant)';
                option.style.pointerEvents = 'none';
            }

            return option;
        }

        renderMeals() {
            if (!this.elements.mealList || !this.elements.emptyState) return;

            if (this.state.filteredMeals.length === 0) {
                this.elements.mealList.innerHTML = '';
                this.elements.emptyState.classList.remove('hide');
                this.elements.emptyState.classList.add('show');
                return;
            }

            this.elements.emptyState.classList.add('hide');
            this.elements.emptyState.classList.remove('show');
            this.elements.mealList.innerHTML = '';
            const fragment = document.createDocumentFragment();

            this.state.filteredMeals.forEach((meal, index) => {
                fragment.appendChild(this.createMealCard(meal, index));
            });

            this.elements.mealList.appendChild(fragment);
            bulkLoadLazyImg();
        }

        createMealCard(meal, index) {
            const card = document.createElement('article');
            card.className = 'meal-card';
            card.dataset.id = meal.id;
            card.style.animationDelay = `${index * 0.1}s`;

            const menuTags = meal.menu.map((item, i) =>
                `<span class="menu-item-tag" style="animation-delay: ${0.1 + i * 0.05}s">${item.name}</span>`
            ).join('');

            card.innerHTML = `
                <div class="card-image">
                    <div class="card-restaurant-badge">${meal.restaurant}${meal.branch ? '・' + meal.branch : ''}</div>
                    <div class="lazy-image-container">
                        <img src="https://dummyimage.com/600x300" data-src="${meal.img}" alt="${meal.restaurant}">
                    </div>
                </div>
                <div class="card-content">
                    <h3 class="card-subtitle">
                        <span class="material-symbols-rounded">event</span>${this.formatDate(meal.date)}
                    </h3>
                    <div class="card-menu-preview">${menuTags}</div>
                    <div class="card-info">
                        <span>${meal.menu.length} 道菜</span>
                        <span class="card-cost">$ ${meal.totalCost.toLocaleString()}</span>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => this.showMealDetail(meal));
            return card;
        }

        renderRestaurants() {
            if (!this.elements.restaurantList) return;

            this.elements.restaurantList.innerHTML = '';
            const fragment = document.createDocumentFragment();

            if (this.state.restaurants.length === 0) {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'empty-state';
                emptyItem.innerHTML = `
                    <span class="material-symbols-rounded">restaurant</span>
                    <h3>還沒有收藏餐廳</h3>
                    <p>添加收藏餐廳後，新增紀錄時會被優先推薦</p>
                `;
                fragment.appendChild(emptyItem);
            } else {
                this.state.restaurants.slice().reverse().forEach((restaurant, index) => {
                    fragment.appendChild(this.createRestaurantItem(restaurant, index));
                });
            }

            this.elements.restaurantList.appendChild(fragment);
        }

        createRestaurantItem(restaurant, index) {
            const item = document.createElement('div');
            item.className = 'restaurant-item';
            item.dataset.id = restaurant.id;
            item.style.animationDelay = `${index * 0.1}s`;

            const menuCount = restaurant.menuItems?.length || 0;
            const menuItemsHtml = menuCount > 0
                ? `
                <div class="restaurant-menu-items-preview">
                    <div class="menu-items-list">
                        ${restaurant.menuItems.map((item, i) => `
                            <div class="menu-item-preview" style="animation-delay: ${i * 0.05}s">
                                <span class="menu-item-name">${item.name}</span>
                                <span class="menu-item-price">$ ${item.price}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
              `
                : `
                <div class="restaurant-menu-items-preview empty">
                    <span class="material-symbols-rounded">menu</span>
                    <p>尚未添加收藏餐點</p>
                </div>
              `;

            item.innerHTML = `
            <div class="restaurant-actions">
                <button class="restaurant-action-btn edit">
                    <span class="material-symbols-rounded" style="font-size:18px;">edit</span>
                </button>
                <button class="restaurant-action-btn delete">
                    <span class="material-symbols-rounded" style="font-size:18px;">delete</span>
                </button>
            </div>
            <div class="restaurant-header">
                <div class="restaurant-name">${restaurant.name}</div>
                <div class="restaurant-branch">${restaurant.branch}</div>
            </div>
            ${restaurant.address ? `<div class="restaurant-address">
                <span class="material-symbols-rounded" style="font-size:16px;">place</span>${restaurant.address}
            </div>` : ''}
            ${restaurant.notes ? `<div class="restaurant-notes">${restaurant.notes}</div>` : ''}
            ${menuItemsHtml}
        `;

            return item;
        }

        renderMenuRecommendations(restaurantName) {
            if (!this.elements.menuRecommendationsList) return;

            if (!restaurantName.trim()) {
                this.elements.menuRecommendationsList.innerHTML = '<div class="empty-recommendation">請先選擇或輸入餐廳名稱</div>';
                return;
            }

            const recommendations = this.getRecordRecommendations(restaurantName);

            if (recommendations.length === 0) {
                this.elements.menuRecommendationsList.innerHTML = '<div class="empty-recommendation">暫無該餐廳的推薦菜品</div>';
                return;
            }

            this.elements.menuRecommendationsList.innerHTML = '';
            const fragment = document.createDocumentFragment();

            recommendations.forEach(item => {
                const recItem = document.createElement('div');
                recItem.className = 'recommendation-btn';
                recItem.innerHTML = `
                    <span class="name">${item.name}，$${item.price}</span>
                    ${item.source === 'custom' ? '<span class="source-badge">收藏餐點</span>' : ''}
                    ${item.source === 'history' ? `<span class="source-badge history">點過 ${item.count} 次</span>` : ''}
                `;

                recItem.addEventListener('click', () => {
                    this.addMenuItem(true);
                    const lastForm = this.elements.menuItemsList.lastChild;
                    lastForm.querySelector('.menu-item-name').value = item.name;
                    lastForm.querySelector('.menu-item-price').value = item.price;
                    this.calculateMenuTotal();
                });

                fragment.appendChild(recItem);
            });

            this.elements.menuRecommendationsList.appendChild(fragment);
        }

        updateRestaurantMenuRecommendations(restaurantName) {
            if (!this.elements.frequentRestaurantMenuRecList) return;

            if (!restaurantName.trim()) {
                this.elements.frequentRestaurantMenuRecList.innerHTML = '<div class="empty-recommendation">請輸入餐廳名稱以獲取推薦</div>';
                return;
            }

            const restaurant = this.state.restaurants.find(r => r.id === this.state.editingRestaurantId);
            const existingItems = (restaurant?.menuItems || []).map(item => item.name);
            const recommendations = this.getRecommendationsForRestaurant(restaurantName)
                .filter(item => !existingItems.includes(item.name))
                .slice(0, 5);

            if (recommendations.length === 0) {
                this.elements.frequentRestaurantMenuRecList.innerHTML = '<div class="empty-recommendation">無未儲存之菜品紀錄</div>';
                return;
            }

            this.elements.frequentRestaurantMenuRecList.innerHTML = '';
            const fragment = document.createDocumentFragment();

            recommendations.forEach(item => {
                const recItem = document.createElement('div');
                recItem.className = 'recommendation-btn';
                recItem.innerHTML = `
                <span class="name">${item.name}，$${item.price}</span>
                <span class="source-badge">點過 ${item.count} 次</span>
            `;

                recItem.addEventListener('click', () => {
                    this.addRestaurantMenuItem(this.state.editingRestaurantId, item.name, item.price);
                });

                fragment.appendChild(recItem);
            });

            this.elements.frequentRestaurantMenuRecList.appendChild(fragment);
        }

        updatePopularItemsFromMeals() {
            this.state.popularItems = {};
            this.state.meals.forEach(meal => {
                meal.menu.forEach(item => {
                    const key = item.name.trim();
                    if (!key) return;

                    if (this.state.popularItems[key]) {
                        this.state.popularItems[key].count += 1;
                        this.state.popularItems[key].avgPrice = Math.round(
                            (this.state.popularItems[key].avgPrice * (this.state.popularItems[key].count - 1) + item.price)
                            / this.state.popularItems[key].count
                        );
                    } else {
                        this.state.popularItems[key] = { count: 1, avgPrice: item.price };
                    }
                });
            });
            // 改用壓縮儲存
            this.saveToStorageWithCompression(this.STORAGE_KEYS.POPULAR_ITEMS, this.state.popularItems);
        }

        getRecommendationsForRestaurant(restaurantName) {
            const restaurantMeals = this.state.meals.filter(meal => meal.restaurant === restaurantName);
            const restaurantItems = {};

            restaurantMeals.forEach(meal => {
                meal.menu.forEach(item => {
                    const key = item.name.trim();
                    if (!key) return;

                    if (restaurantItems[key]) {
                        restaurantItems[key].count += 1;
                        restaurantItems[key].avgPrice = Math.round(
                            (restaurantItems[key].avgPrice * (restaurantItems[key].count - 1) + item.price)
                            / restaurantItems[key].count
                        );
                    } else {
                        restaurantItems[key] = { count: 1, avgPrice: item.price };
                    }
                });
            });

            return Object.entries(restaurantItems)
                .map(([name, data]) => ({ name, price: data.avgPrice, count: data.count }))
                .sort((a, b) => b.count - a.count);
        }

        getRecordRecommendations(restaurantName) {
            const restaurant = this.state.restaurants.find(r => r.name === restaurantName);
            const customItems = (restaurant?.menuItems || []).map(item => ({ ...item, source: 'custom' }));
            const historyItems = this.getRecommendationsForRestaurant(restaurantName)
                .filter(item => !customItems.some(c => c.name === item.name))
                .map(item => ({ ...item, source: 'history' }))
                // .slice(0, 5)
                ;

            return [...customItems, ...historyItems];
        }

        renderRestaurantMenuItems(restaurantId) {
            if (!this.elements.frequentRestaurantMenuItems) return;

            const restaurant = this.state.restaurants.find(r => r.id === restaurantId);
            if (!restaurant) {
                this.elements.frequentRestaurantMenuItems.innerHTML = '';
                return;
            }

            if (!restaurant.menuItems) restaurant.menuItems = [];
            this.elements.frequentRestaurantMenuItems.innerHTML = '';
            const fragment = document.createDocumentFragment();

            restaurant.menuItems.forEach((item, index) => {
                fragment.appendChild(this.createMenuForm(item, index, true));
            });

            if (restaurant.menuItems.length === 0) {
                fragment.appendChild(this.createMenuForm({}, 0, true));
            }

            this.elements.frequentRestaurantMenuItems.appendChild(fragment);
        }

        createMenuForm(item, index, isRestaurantMenu = false) {
            const form = document.createElement('div');
            form.className = 'menu-item-form';
            form.dataset.index = index;
            form.innerHTML = `
                <div class="form-group">
                    <label for="${isRestaurantMenu ? 'rest-' : ''}menu-item-${index}-name">菜品名稱</label>
                    <input type="text" id="${isRestaurantMenu ? 'rest-' : ''}menu-item-${index}-name" 
                           class="menu-item-name" placeholder="菜品名稱" value="${item.name || ''}" required>
                    <div class="form-error">請輸入菜品名稱</div>
                </div>
                <div class="form-group">
                    <label for="${isRestaurantMenu ? 'rest-' : ''}menu-item-${index}-price">價格</label>
                    <input type="number" id="${isRestaurantMenu ? 'rest-' : ''}menu-item-${index}-price" 
                           class="menu-item-price" min="0" step="1" placeholder="0" value="${item.price || ''}" required>
                    <div class="form-error">請輸入有效價格</div>
                </div>
                <button type="button" class="remove-menu-item"><span class="material-symbols-rounded" style="font-size:20px;">close</span></button>
            `;

            form.style.opacity = '0';
            form.style.transform = 'translateY(10px)';
            setTimeout(() => {
                form.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                form.style.opacity = '1';
                form.style.transform = 'translateY(0)';
            }, 10);

            if (document.querySelectorAll('.menu-item-form').length <= 1) {
                form.querySelector('.remove-menu-item').style.display = 'none';
            }

            return form;
        }

        addMenuItem(silent = false, isRestaurantMenu = false) {
            const container = isRestaurantMenu
                ? this.elements.frequentRestaurantMenuItems
                : this.elements.menuItemsList;
            if (!container) return;

            const count = container.querySelectorAll('.menu-item-form').length;
            container.appendChild(this.createMenuForm({}, count, isRestaurantMenu));

            if (count >= 1) {
                document.querySelectorAll('.menu-item-form .remove-menu-item').forEach(btn => {
                    btn.style.display = 'flex';
                });
            }

            if (!silent && !isRestaurantMenu) this.calculateMenuTotal();
        }

        calculateMenuTotal() {
            if (!this.elements.menuTotalAmount) return 0;

            let total = 0;
            document.querySelectorAll('.menu-item-form').forEach(form => {
                total += parseInt(form.querySelector('.menu-item-price').value) || 0;
            });
            this.elements.menuTotalAmount.textContent = `$ ${total.toLocaleString()}`;
            return total;
        }

        openAddMealForm() {
            if (!this.elements.addMealPanel || !this.elements.editMealId || !this.elements.formTitle) return;

            this.elements.formTitle.textContent = '新增用餐紀錄';
            this.elements.editMealId.value = '';
            this.resetMealForm();
            this.panelInstance.openPanel('add-meal-panel');
        }

        closeAddForm() {
            this.panelInstance.closePanel('add-meal-panel');
            this.resetMealForm();
        }

        resetMealForm() {
            if (!this.elements.addMealForm || !this.elements.menuItemsList || !this.elements.imagePreview || !this.elements.imageUrl || !this.elements.menuRecommendationsList || !this.elements.mealDate || !this.elements.restaurantName || !this.elements.restaurantBranch) return;

            this.elements.addMealForm.reset();
            this.elements.menuItemsList.innerHTML = '';
            this.addMenuItem(true);
            this.elements.imagePreview.innerHTML = '<span class="material-symbols-rounded upload-icon">add_photo_alternate</span>';
            this.elements.imageUrl.value = '';
            this.state.currentImageData = null;
            this.elements.menuRecommendationsList.innerHTML = '';
            this.calculateMenuTotal();

            document.querySelectorAll('.form-group').forEach(group => group.classList.remove('error'));

            this.elements.mealDate.value = this.getLocalYMD();
            // console.log(new Date().toISOString());
            this.elements.restaurantName.value = '';
            this.elements.restaurantBranch.value = '';

            this.state.tempMenuItem = null;
            this.state.tempMenuItems = [];
        }

        validateRestaurantSelection() {
            if (!this.elements.restaurantName) return false;

            const name = this.elements.restaurantName.value.trim();
            if (!name) {
                this.elements.restaurantName.closest('.form-group').classList.add('error');
                return false;
            } else {
                this.elements.restaurantName.closest('.form-group').classList.remove('error');
                return true;
            }
        }

        validateMealForm() {
            let isValid = true;

            if (!this.elements.mealDate.value) {
                this.elements.mealDate.closest('.form-group').classList.add('error');
                isValid = false;
            } else {
                this.elements.mealDate.closest('.form-group').classList.remove('error');
            }

            if (!this.validateRestaurantSelection()) isValid = false;

            document.querySelectorAll('.menu-item-form').forEach(form => {
                const nameInput = form.querySelector('.menu-item-name');
                const priceInput = form.querySelector('.menu-item-price');
                const name = nameInput.value.trim();
                const price = priceInput.value;

                if (!name) {
                    nameInput.closest('.form-group').classList.add('error');
                    isValid = false;
                } else {
                    nameInput.closest('.form-group').classList.remove('error');
                }

                if (!price || isNaN(price) || price < 0) {
                    priceInput.closest('.form-group').classList.add('error');
                    isValid = false;
                } else {
                    priceInput.closest('.form-group').classList.remove('error');
                }
            });

            return isValid;
        }

        addRestaurantMenuItem(restaurantId, prefillName = '', prefillPrice = '') {
            if (!this.elements.frequentRestaurantMenuItems) return;

            const currentItems = [];
            document.querySelectorAll('#frequent-restaurant-menu-items .menu-item-form').forEach(form => {
                const name = form.querySelector('.menu-item-name').value.trim();
                const price = parseInt(form.querySelector('.menu-item-price').value) || 0;
                if (name) currentItems.push({ name, price });
            });

            if (prefillName) {
                currentItems.push({ name: prefillName, price: prefillPrice });
            } else {
                currentItems.push({ name: '', price: 0 });
            }

            this.elements.frequentRestaurantMenuItems.innerHTML = '';
            currentItems.forEach((item, index) => {
                this.elements.frequentRestaurantMenuItems.appendChild(this.createMenuForm(item, index, true));
            });

            document.querySelectorAll('.menu-item-form .remove-menu-item').forEach(btn => {
                btn.style.display = currentItems.length >= 1 ? 'block' : 'none';
            });

            const restaurant = this.state.restaurants.find(r => r.id === restaurantId);
            if (restaurant) restaurant.menuItems = currentItems;
            else this.state.tempMenuItems = currentItems;
        }

        getRecommendedRestaurants() {
            const allRestaurantsFromMeals = new Set(this.state.meals.map(meal => meal.restaurant));
            const existingRestaurants = new Set(this.state.restaurants.map(rest => rest.name));
            const recommended = [];

            allRestaurantsFromMeals.forEach(name => {
                if (!existingRestaurants.has(name)) {
                    recommended.push({
                        name,
                        count: this.state.meals.filter(meal => meal.restaurant === name).length
                    });
                }
            });

            return recommended.sort((a, b) => b.count - a.count);
        }

        openRestaurantForm(restaurantId = null) {
            if (!document.getElementById('frequent-restaurant-panel')) {
                console.error('未找到 frequent-restaurant-panel 面板');
                return;
            }

            this.state.editingRestaurantId = restaurantId;
            if (this.elements.frequentRestaurantForm) {
                this.elements.frequentRestaurantForm.reset();
            }

            if (this.elements.frequentRestaurantMenuItems) {
                this.elements.frequentRestaurantMenuItems.innerHTML = '';
            } else {
                console.warn('未找到 frequent-restaurant-menu-items 容器');
            }

            this.state.tempMenuItems = [];

            if (restaurantId) {
                const restaurant = this.state.restaurants.find(r => r.id === restaurantId);
                if (restaurant) {
                    this.state.currentRestaurantName = restaurant.name;
                    if (this.elements.frequentRestaurantFormTitle) {
                        this.elements.frequentRestaurantFormTitle.textContent = '編輯收藏餐廳';
                    }
                    if (this.elements.restaurantId) {
                        this.elements.restaurantId.value = restaurant.id;
                    }
                    if (this.elements.frequentRestaurantName) {
                        this.elements.frequentRestaurantName.value = restaurant.name;
                    }
                    if (this.elements.frequentRestaurantBranch) {
                        this.elements.frequentRestaurantBranch.value = restaurant.branch || '';
                    }
                    if (this.elements.frequentRestaurantAddress) {
                        this.elements.frequentRestaurantAddress.value = restaurant.address || '';
                    }
                    if (this.elements.frequentRestaurantNotes) {
                        this.elements.frequentRestaurantNotes.value = restaurant.notes || '';
                    }
                    this.renderRestaurantMenuItems(restaurantId);
                    this.updateRestaurantMenuRecommendations(restaurant.name);
                }
            } else {
                this.state.currentRestaurantName = '';
                if (this.elements.frequentRestaurantFormTitle) {
                    this.elements.frequentRestaurantFormTitle.textContent = '添加收藏餐廳';
                }
                if (this.elements.restaurantId) {
                    this.elements.restaurantId.value = '';
                }
                if (this.elements.frequentRestaurantMenuRecList) {
                    this.elements.frequentRestaurantMenuRecList.innerHTML = '<div class="empty-recommendation">請輸入餐廳名稱以獲取推薦</div>';
                }

                const form = this.createMenuForm(this.state.tempMenuItem || {}, 0, true);
                this.elements.frequentRestaurantMenuItems?.appendChild(form);

                if (this.state.tempMenuItem) {
                    this.state.tempMenuItems.push(this.state.tempMenuItem);
                    this.state.tempMenuItem = null;
                } else {
                    this.state.tempMenuItems.push({ name: '', price: 0 });
                }
            }

            this.panelInstance.openPanel('frequent-restaurant-panel');
        }

        closeRestaurantForm() {
            this.panelInstance.closePanel('frequent-restaurant-panel');
            this.state.editingRestaurantId = null;
            this.state.currentRestaurantName = '';
        }

        validateRestaurantForm() {
            if (!this.elements.frequentRestaurantName) return false;

            const name = this.elements.frequentRestaurantName.value.trim();
            if (!name) {
                this.elements.frequentRestaurantName.closest('.form-group').classList.add('error');
                return false;
            }

            this.elements.frequentRestaurantName.closest('.form-group').classList.remove('error');
            return true;
        }

        saveRestaurant() {
            if (!this.elements.frequentRestaurantName || !this.elements.frequentRestaurantForm) {
                console.error('缺少收藏餐廳表單元素');
                this.showToast('系統錯誤，請重試');
                return;
            }

            const name = this.elements.frequentRestaurantName.value.trim();
            if (!name) {
                this.elements.frequentRestaurantName.closest('.form-group').classList.add('error');
                this.showToast('請輸入餐廳名稱');
                return;
            }

            const restaurantId = this.elements.restaurantId?.value || '';
            const isEditMode = !!restaurantId;
            const branch = this.elements.frequentRestaurantBranch?.value.trim() || '';
            const address = this.elements.frequentRestaurantAddress?.value.trim() || '';
            const notes = this.elements.frequentRestaurantNotes?.value.trim() || '';

            const menuItems = [];
            document.querySelectorAll('#frequent-restaurant-menu-items .menu-item-form').forEach(form => {
                const itemName = form.querySelector('.menu-item-name').value.trim();
                const itemPrice = parseInt(form.querySelector('.menu-item-price').value) || 0;
                if (itemName) menuItems.push({ name: itemName, price: itemPrice });
            });

            if (menuItems.length === 0) {
                this.showToast('請至少添加一項菜單');
                return;
            }

            if (isEditMode) {
                const index = this.state.restaurants.findIndex(r => r.id === restaurantId);
                if (index !== -1) {
                    this.state.restaurants[index] = { ...this.state.restaurants[index], name, branch, address, notes, menuItems };
                    this.showToast('餐廳資訊已更新');
                }
            } else {
                this.state.restaurants.push({ id: this.generateId(), name, branch, address, notes, menuItems });
                this.showToast('新餐廳已添加');
            }

            // 改用壓縮儲存
            this.saveToStorageWithCompression(this.STORAGE_KEYS.RESTAURANTS, this.state.restaurants);
            this.renderRestaurants();
            this.closeRestaurantForm();
            this.autoCompleteInstances.mealRestaurant?.filterAndRender('');
        }

        deleteRestaurant(restaurantId) {
            this.state.restaurants = this.state.restaurants.filter(r => r.id !== restaurantId);
            // 改用壓縮儲存
            this.saveToStorageWithCompression(this.STORAGE_KEYS.RESTAURANTS, this.state.restaurants);
            this.renderRestaurants();
            this.showToast('餐廳已刪除');
        }

        showMealDetail(meal) {
            if (!this.elements.detailImg ||
                !this.elements.detailTitle ||
                !this.elements.detailCost ||
                !this.elements.detailMenuItems ||
                !this.elements.detailDate
            ) return;

            this.state.currentMealId = meal.id;
            this.elements.detailImg.src = meal.img;
            this.elements.detailTitle.innerHTML = `${meal.restaurant}<sub>${meal.branch || ''}</sub>`;
            this.elements.detailDate.textContent = `${this.formatDate(meal.date)}`;
            this.elements.detailCost.textContent = `$ ${meal.totalCost.toLocaleString()}`;

            this.elements.detailMenuItems.innerHTML = '';
            const fragment = document.createDocumentFragment();

            meal.menu.forEach((item, index) => {
                const menuItem = document.createElement('div');
                menuItem.className = 'menu-item';
                menuItem.style.animationDelay = `${index * 0.1}s`;
                menuItem.style.opacity = '0';
                menuItem.style.transform = 'translateY(10px)';
                menuItem.style.animation = 'fadeInUp 0.3s ease forwards';
                menuItem.innerHTML = `
                    <span class="menu-item-name">${item.name}</span>
                    <span class="menu-item-price">$ ${item.price.toLocaleString()}</span>
                `;
                fragment.appendChild(menuItem);
            });

            this.elements.detailMenuItems.appendChild(fragment);
            this.panelInstance.openPanel('detail-panel');
        }

        copyMealRecord(mealId) {
            if (!this.elements.editMealId || !this.elements.addMealPanel || !this.elements.mealDate || !this.elements.imageUrl || !this.elements.restaurantName || !this.elements.restaurantBranch) return;

            const meal = this.state.meals.find(m => m.id === mealId);
            if (!meal) return;

            this.elements.editMealId.value = '';
            this.elements.formTitle.textContent = '複製用餐紀錄';
            this.panelInstance.openPanel('add-meal-panel');

            this.fillRestaurantInfo(meal.restaurant, meal.branch);
            this.elements.mealDate.value = this.getLocalYMD();
            this.fillMenuItems(meal.menu);
            this.displayImage(meal.img);
            this.elements.imageUrl.value = meal.img;

            this.calculateMenuTotal();
            this.showToast('成功複製');
            this.panelInstance.closePanel('detail-panel');
            this.state.currentMealId = null;
        }

        editMealRecord(mealId) {
            if (!this.elements.editMealId || !this.elements.addMealPanel || !this.elements.mealDate || !this.elements.imageUrl || !this.elements.restaurantName || !this.elements.restaurantBranch) return;

            const meal = this.state.meals.find(m => m.id === mealId);
            if (!meal) return;

            this.elements.editMealId.value = mealId;
            this.elements.formTitle.textContent = '編輯用餐紀錄';
            this.panelInstance.openPanel('add-meal-panel');

            this.fillRestaurantInfo(meal.restaurant, meal.branch);
            this.elements.mealDate.value = meal.date;
            this.fillMenuItems(meal.menu);
            this.displayImage(meal.img);
            this.elements.imageUrl.value = meal.img;

            this.calculateMenuTotal();
            this.panelInstance.closePanel('detail-panel');
            this.state.currentMealId = null;
        }

        deleteMealRecord(mealId) {
            this.state.meals = this.state.meals.filter(meal => meal.id !== mealId);
            this.state.filteredMeals = this.state.filteredMeals.filter(meal => meal.id !== mealId);
            this.saveToStorageWithCompression(this.STORAGE_KEYS.MEALS, this.state.meals);
            this.updatePopularItemsFromMeals();
            this.renderMeals();
            this.showToast('成功刪除');
        }

        fillMenuItems(menuItems) {
            if (!this.elements.menuItemsList) return;

            this.elements.menuItemsList.innerHTML = '';
            menuItems.forEach((item, index) => {
                this.addMenuItem(true);
                const lastForm = this.elements.menuItemsList.lastChild;
                lastForm.querySelector('.menu-item-name').value = item.name;
                lastForm.querySelector('.menu-item-price').value = item.price;
            });
        }

        fillRestaurantInfo(restaurantName, branch = '') {
            if (!this.elements.restaurantName || !this.elements.restaurantBranch) return;

            this.elements.restaurantName.value = restaurantName;
            this.elements.restaurantBranch.value = branch;
            this.renderMenuRecommendations(restaurantName);
        }

        sortMealsByDate() {
            this.state.meals.sort((a, b) => {
                if (a.date === b.date) {
                    return b.id.localeCompare(a.id);
                }
                return b.date.localeCompare(a.date);
            });
        }

        saveMealRecord() {
            if (!this.elements.editMealId || !this.elements.restaurantName || !this.elements.restaurantBranch || !this.elements.mealDate) return;

            if (!this.validateMealForm()) {
                this.showToast('表單填寫有誤，請檢查');
                return;
            }

            const editMealId = this.elements.editMealId.value;
            const isEditMode = !!editMealId;
            const restaurant = this.elements.restaurantName.value.trim();
            const branch = this.elements.restaurantBranch.value.trim();

            const menuItems = [];
            document.querySelectorAll('.menu-item-form').forEach(form => {
                const name = form.querySelector('.menu-item-name').value.trim();
                const price = parseInt(form.querySelector('.menu-item-price').value) || 0;
                if (name) {
                    menuItems.push({ name, price });
                }
            });

            if (menuItems.length === 0) {
                this.showToast('請至少添加一道菜品');
                return;
            }

            const totalCost = menuItems.reduce((sum, item) => sum + item.price, 0);
            let img = this.state.currentImageData;

            if (!img) {
                const color = this.getRandomColor();
                // const imgText = restaurant.length > 6 ? `${restaurant.substring(0, 6)}...` : restaurant;
                img = `https://dummyimage.com/600x400/${color}/FFFFFF?text=${restaurant}`;
            }

            if (isEditMode) {
                const index = this.state.meals.findIndex(meal => meal.id === editMealId);
                if (index !== -1) {
                    this.state.meals[index] = { ...this.state.meals[index], restaurant, branch, date: this.elements.mealDate.value, menu: menuItems, totalCost, img };
                }
            } else {
                this.state.meals.push({
                    id: this.generateId(),
                    restaurant,
                    branch,
                    date: this.elements.mealDate.value,
                    menu: menuItems,
                    totalCost,
                    img
                });
            }

            this.sortMealsByDate();
            this.state.filteredMeals = [...this.state.meals];
            this.applyFilter();

            this.saveToStorageWithCompression(this.STORAGE_KEYS.MEALS, this.state.meals);
            this.updatePopularItemsFromMeals();
            this.renderMeals();
            this.updateCustomSelectOptions();

            this.closeAddForm();
            this.resetMealForm();
            this.showToast(isEditMode ? '成功更新' : '成功儲存');
        }

        applyFilter() {
            if (!this.elements.restaurantFilterContainer || !this.elements.startDate || !this.elements.endDate) return;

            const selectedRestaurant = this.elements.restaurantFilterContainer.querySelector('.select-option.selected')?.dataset.value;
            const startDate = this.elements.startDate.value;
            const endDate = this.elements.endDate.value;

            this.state.filteredMeals = this.state.meals.filter(meal => {
                if (selectedRestaurant && meal.restaurant !== selectedRestaurant) return false;
                if (startDate && meal.date < startDate) return false;
                if (endDate && meal.date > endDate) return false;
                return true;
            });

            this.state.filteredMeals.sort((a, b) => {
                if (a.date === b.date) return b.id.localeCompare(a.id);
                return b.date.localeCompare(a.date);
            });

            this.renderMeals();
        }

        displayImage(src) {
            if (!this.elements.imagePreview) return;

            this.elements.imagePreview.innerHTML = '';
            const img = document.createElement('img');
            img.src = src;
            img.alt = '餐點照片';

            img.onerror = () => {
                this.elements.imagePreview.innerHTML = '<span class="material-symbols-rounded upload-icon">error</span>';
                this.showToast('圖片載入失敗，請更換圖片或 URL');
                this.state.currentImageData = null;
            };

            img.onload = () => { this.state.currentImageData = src; };
            this.elements.imagePreview.appendChild(img);
        }

        initDataManagement() {
            if (this.elements.exportDataBtn) {
                this.elements.exportDataBtn.addEventListener('click', () => this.exportDataCompressed());
            }
            if (this.elements.importDataBtn) {
                this.elements.importDataBtn.addEventListener('click', () => this.triggerImport());
            }
            if (this.elements.importFileInput) {
                this.elements.importFileInput.addEventListener('change', (e) => this.importData(e));
            }
        }

        triggerImport() {
            if (this.elements.importFileInput) {
                this.elements.importFileInput.value = '';
                this.elements.importFileInput.click();
            }
        }

        validateImportData(data) {
            if (!data || typeof data !== 'object') return false;
            if (!Array.isArray(data.meals)) return false;
            if (!Array.isArray(data.restaurants)) return false;
            if (typeof data.popularItems !== 'object') return false;
            return true;
        }

        exportDataCompressed() {
            try {
                const exportData = {
                    meals: this.state.meals,
                    restaurants: this.state.restaurants,
                    popularItems: this.state.popularItems
                };

                const jsonString = JSON.stringify(exportData);
                const compressed = pako.gzip(jsonString);
                const blob = new Blob([compressed], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                const date = this.getLocalYMD();
                const newDate = date.split('-');
                newDate[0] -= 1911;
                a.download = `匯出壓縮檔_${newDate.join('')}.吃吃吃`;
                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);

                this.showToast('成功匯出資料');
            } catch (error) {
                console.error('壓縮匯出失敗：', error);
                this.showToast('壓縮資料匯出失敗，請重試');
            }
        }

        importDataCompressed(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const compressed = new Uint8Array(arrayBuffer);
                    const jsonString = pako.ungzip(compressed, { to: 'string' });
                    const importedData = JSON.parse(jsonString);

                    if (!this.validateImportData(importedData)) {
                        this.showToast('格式異常，請使用正確的文件');
                        return;
                    }

                    if (confirm('是否匯入資料？原紀錄將被覆蓋！')) {
                        this.saveToStorageWithCompression(this.STORAGE_KEYS.MEALS, importedData.meals || []);
                        this.saveToStorageWithCompression(this.STORAGE_KEYS.RESTAURANTS, importedData.restaurants || []);
                        this.saveToStorageWithCompression(this.STORAGE_KEYS.POPULAR_ITEMS, importedData.popularItems || {});

                        this.loadData();
                        this.renderMeals();
                        this.renderRestaurants();
                        this.updatePopularItemsFromMeals();
                        this.initAutoComplete();
                        this.updateCustomSelectOptions();

                        this.showToast('成功匯入');
                    }
                } catch (error) {
                    console.error('解壓縮匯入失敗：', error);
                    this.showToast('解壓縮失敗');
                }
            };
            reader.readAsArrayBuffer(file);
        }

        importData(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                this.handleImportContent(e.target.result, file.name);
            };

            if (file.name.endsWith('.吃吃吃')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        }

        handleImportContent(content, filename) {
            try {
                let importedData;

                if (filename.endsWith('.吃吃吃')) {
                    const compressed = new Uint8Array(content);
                    const jsonString = pako.ungzip(compressed, { to: 'string' });
                    importedData = JSON.parse(jsonString);
                } else if (filename.endsWith('.fdbackup')) {
                    const decrypted = this.simpleDecrypt(content);
                    if (!decrypted) throw new Error('解密失敗');
                    importedData = JSON.parse(decrypted);
                } else {
                    if (this.isBase64(content)) {
                        const jsonString = decodeURIComponent(escape(atob(content)));
                        importedData = JSON.parse(jsonString);
                    } else {
                        importedData = JSON.parse(content);
                    }
                }

                if (!this.validateImportData(importedData)) {
                    this.showToast('文件格式不正確，請使用正確的備份文件');
                    return;
                }

                if (confirm('是否匯入資料？原紀錄將被覆蓋！')) {
                    this.saveToStorageWithCompression(this.STORAGE_KEYS.MEALS, importedData.meals || []);
                    this.saveToStorageWithCompression(this.STORAGE_KEYS.RESTAURANTS, importedData.restaurants || []);
                    this.saveToStorageWithCompression(this.STORAGE_KEYS.POPULAR_ITEMS, importedData.popularItems || {});

                    this.loadData();
                    this.renderMeals();
                    this.renderRestaurants();
                    this.updatePopularItemsFromMeals();
                    this.initAutoComplete();
                    this.updateCustomSelectOptions();

                    this.showToast('成功匯入');
                }
            } catch (error) {
                console.error('匯入失敗：', error);
                this.showToast('文件解析錯誤，請檢查文件是否完好');
            }
        }

        isBase64(str) {
            try {
                return btoa(atob(str)) === str;
            } catch (e) {
                return false;
            }
        }

        simpleDecrypt(data) {
            return null;
        }

        bindEvents() {
            document.querySelectorAll('.tab-item').forEach(tab => {
                tab.addEventListener('click', function () {
                    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    const tabType = this.dataset.tab;

                    const recordsContent = document.querySelector('.width-container:nth-child(1)');
                    const restaurantsContent = document.querySelector('.width-container:nth-child(2)');

                    if (recordsContent && restaurantsContent) {
                        if (tabType === 'records') {
                            recordsContent.classList.add('show');
                            recordsContent.classList.remove('hide');
                            restaurantsContent.classList.remove('show');
                            restaurantsContent.classList.add('hide');
                        } else {
                            recordsContent.classList.remove('show');
                            recordsContent.classList.add('hide');
                            restaurantsContent.classList.add('show');
                            restaurantsContent.classList.remove('hide');
                        }
                    }
                });
            });

            // 用餐表單提交
            if (this.elements.addMealForm) {
                this.elements.addMealForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveMealRecord();
                });
            }

            // 收藏餐廳表單提交
            if (this.elements.frequentRestaurantForm) {
                this.elements.frequentRestaurantForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveRestaurant();
                });
            }

            // FAB按鈕
            if (this.elements.fabMainButton) {
                this.elements.fabMainButton.addEventListener('click', () => this.openAddMealForm());
            }

            // 面板關閉
            if (this.elements.formClose) {
                this.elements.formClose.addEventListener('click', () => this.closeAddForm());
            }
            if (this.elements.formCancelBtn) {
                this.elements.formCancelBtn.addEventListener('click', () => this.closeAddForm());
            }
            if (this.elements.detailClose) {
                this.elements.detailClose.addEventListener('click', () => {
                    this.panelInstance.closePanel('detail-panel');
                    this.state.currentMealId = null;
                });
            }
            if (this.elements.panelBackdrop) {
                this.elements.panelBackdrop.addEventListener('click', () => this.panelInstance.closeAllPanels());
            }

            // 詳情頁按鈕
            if (this.elements.detailCopyBtn) {
                this.elements.detailCopyBtn.addEventListener('click', () => {
                    if (this.state.currentMealId) this.copyMealRecord(this.state.currentMealId);
                });
            }
            if (this.elements.detailEditBtn) {
                this.elements.detailEditBtn.addEventListener('click', () => {
                    if (this.state.currentMealId) this.editMealRecord(this.state.currentMealId);
                });
            }
            if (this.elements.detailDeleteBtn) {
                this.elements.detailDeleteBtn.addEventListener('click', () => {
                    if (this.state.currentMealId && confirm('確定刪除？')) {
                        this.deleteMealRecord(this.state.currentMealId);
                        this.panelInstance.closePanel('detail-panel');
                    }
                });
            }

            // 收藏餐廳表單關閉
            if (this.elements.frequentRestaurantClose) {
                this.elements.frequentRestaurantClose.addEventListener('click', () => this.closeRestaurantForm());
            }
            if (this.elements.frequentRestaurantFormCancel) {
                this.elements.frequentRestaurantFormCancel.addEventListener('click', () => this.closeRestaurantForm());
            }

            // 篩選功能
            if (this.elements.filterToggle) {
                this.elements.filterToggle.addEventListener('click', () => {
                    this.elements.filterToggle.parentElement.classList.toggle('expanded');
                });
            }
            if (this.elements.filterButton) {
                this.elements.filterButton.addEventListener('click', () => this.applyFilter());
            }
            if (this.elements.resetFilter) {
                this.elements.resetFilter.addEventListener('click', () => {
                    if (this.elements.restaurantFilterContainer) {
                        this.elements.restaurantFilterContainer.querySelector('.select-option[data-value=""]')?.click();
                    }
                    if (this.elements.startDate) this.elements.startDate.value = '';
                    if (this.elements.endDate) this.elements.endDate.value = '';
                    this.applyFilter();
                });
            }

            // 清空紀錄
            if (this.elements.clearAll) {
                this.elements.clearAll.addEventListener('click', () => {
                    if (confirm('確定刪除所有紀錄？')) {
                        this.state.meals = [];
                        this.state.filteredMeals = [];
                        // 改用壓縮儲存
                        this.saveToStorageWithCompression(this.STORAGE_KEYS.MEALS, this.state.meals);
                        this.updatePopularItemsFromMeals();
                        this.renderMeals();
                    }
                });
            }

            // 添加菜單項
            if (this.elements.addMenuItemBtn) {
                this.elements.addMenuItemBtn.addEventListener('click', () => this.addMenuItem());
            }
            if (this.elements.addRestaurantMenuBtn) {
                this.elements.addRestaurantMenuBtn.addEventListener('click', () => {
                    this.addRestaurantMenuItem(this.state.editingRestaurantId);
                });
            }

            // 刪除菜單項
            document.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-menu-item');
                if (!removeBtn) return;

                const form = removeBtn.closest('.menu-item-form');
                const isRestaurantMenu = form.closest('#frequent-restaurant-menu-items') !== null;

                form.remove();

                if (!isRestaurantMenu) this.calculateMenuTotal();

                const remainingForms = document.querySelectorAll('.menu-item-form');
                if (remainingForms.length === 1) {
                    remainingForms[0].querySelector('.remove-menu-item').style.display = 'none';
                }
            });

            // 價格變更時計算總價
            if (this.elements.menuItemsList) {
                this.elements.menuItemsList.addEventListener('input', (e) => {
                    if (e.target.classList.contains('menu-item-price')) this.calculateMenuTotal();
                });
            }

            // 餐廳管理
            if (this.elements.restaurantManager) {
                this.elements.restaurantManager.addEventListener('click', () => {
                    const tab = document.querySelectorAll('.tab-item')[1];
                    if (tab) tab.click();
                });
            }

            if (this.elements.addRestaurantBtn) {
                this.elements.addRestaurantBtn.addEventListener('click', () => {
                    this.openRestaurantForm();
                });
            }

            // 餐廳項操作
            if (this.elements.restaurantList) {
                this.elements.restaurantList.addEventListener('click', (e) => {
                    const editBtn = e.target.closest('.restaurant-action-btn.edit');
                    const deleteBtn = e.target.closest('.restaurant-action-btn.delete');

                    if (editBtn) {
                        this.openRestaurantForm(editBtn.closest('.restaurant-item').dataset.id);
                        return;
                    }

                    if (deleteBtn) {
                        const restaurantId = deleteBtn.closest('.restaurant-item').dataset.id;
                        if (confirm('確定要刪除此收藏餐廳嗎？')) this.deleteRestaurant(restaurantId);
                    }
                });
            }

            // 圖片處理
            if (this.elements.mealImageUpload) {
                this.elements.mealImageUpload.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => this.displayImage(event.target.result);
                        reader.readAsDataURL(file);
                    }
                });
            }

            if (this.elements.loadImageUrl && this.elements.imageUrl) {
                this.elements.loadImageUrl.addEventListener('click', () => {
                    const url = this.elements.imageUrl.value.trim();
                    if (!url) {
                        this.showToast('請輸入圖片 URL');
                        return;
                    }
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                        this.displayImage(url);
                    } else {
                        this.showToast('請輸入有效的圖片 URL');
                    }
                });
            }

            if (this.elements.convertDriveUrl && this.elements.imageUrl) {
                this.elements.convertDriveUrl.addEventListener('click', () => {
                    const url = this.elements.imageUrl.value.trim();
                    if (!url) {
                        this.showToast('請輸入圖片 URL');
                        return;
                    }
                    const newUrl = url.split('?')[0].replace('https://drive.google.com/file/d/', '').replace('/view', '');
                    this.displayImage('https://lh3.googleusercontent.com/d/' + newUrl);
                });
            }

            if (this.elements.imagePreview && this.elements.mealImageUpload) {
                this.elements.imagePreview.addEventListener('click', () => {
                    this.elements.mealImageUpload.click();
                });
            }

            // 收藏餐廳名輸入事件
            if (this.elements.frequentRestaurantName) {
                this.elements.frequentRestaurantName.addEventListener('input', (e) => {
                    const name = e.target.value.trim();
                    this.state.currentRestaurantName = name;
                    this.autoCompleteInstances.frequentRestaurant?.filterAndRender(name);
                    this.updateRestaurantMenuRecommendations(name);
                });
            }

            // 收藏餐廳分店名輸入事件
            if (this.elements.frequentRestaurantBranch) {
                this.elements.frequentRestaurantBranch.addEventListener('input', (e) => {
                    const branch = e.target.value.trim();
                    this.autoCompleteInstances.frequentBranch?.filterAndRender(branch);
                });
            }
        }
    }

    new FoodDiaryApp();
});