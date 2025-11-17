
document.addEventListener('DOMContentLoaded', () => {

    // --- DATA ---
    const STORED_PRODUCTS_KEY = 'field-activity-products';
    const defaultProducts = ['연두', '연두순', '701간장', '금F3', '진S1.7', '국간장', '파스타소스'];

    const loadProducts = (): string[] => {
        const stored = localStorage.getItem(STORED_PRODUCTS_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                    const combined = [...defaultProducts, ...parsed];
                    return [...new Set(combined)]; // Remove duplicates
                }
            } catch (e) {
                console.error("Failed to parse products from localStorage", e);
            }
        }
        return defaultProducts;
    };
    
    const saveProducts = () => {
        const userAddedProducts = DATA.products.filter(p => !defaultProducts.includes(p));
        localStorage.setItem(STORED_PRODUCTS_KEY, JSON.stringify(userAddedProducts));
    };

    const DATA = {
        purpose: ['입점활동', '진열개선', '연관진열', '행사매대유치', '발주요청', '기타활동'],
        products: loadProducts(),
        displayTypes: ['본매대', '엔드매대', '평매대', '걸이매대', '샘표집기', '기타집기', '간이매대', '연관진열소품'],
        otherActivityActions: ['보충진열', '유통기한 확인 및 선입선출', '청결작업', '행사세팅', '스티커부착', '창고정리', '가격표조치', '정기엔드교체', '매장측요청 엔드교체', '유인행사사원 점검', '향후 입점활동을 위한 소통', '매장측 요청으로 타사진열도움'],
        improvementMethods: ['1줄늘리기', '골든존으로 이동', '2줄이상늘리기'],
        requestMethods: ['매장담당자', '대리점담당자'],
        requestMeans: ['구두로 요청', '문자나카톡', '수기작성', '사진전송'],
        eventActions: ['가격행사제품 엔드 및 평대등 행사매대로 이동조치'],
    };

    const PURPOSE_CONFIG = {
        '입점활동': { sections: ['displayType', 'products'] },
        '진열개선': { sections: ['displayType', 'products', 'improvementMethod'] },
        '연관진열': { sections: ['displayType', 'products', 'location'] },
        '행사매대유치': { sections: ['displayType', 'products', 'eventActions'] },
        '발주요청': { sections: ['displayType', 'products', 'requestMethod', 'requestMean'] },
        '기타활동': { sections: ['displayType', 'products', 'otherActivityActions'] }
    };

    // --- STATE ---
    interface Activity {
        id: number;
        summary: string;
        data: Record<string, any>;
    }
    let activities: Activity[] = [];
    let nextActivityId = 0;
    
    const initialSelection = {
        purpose: '',
        displayType: [],
        products: [],
        improvementMethod: [],
        location: '',
        requestMethod: [],
        requestMean: [],
        otherActivityActions: [],
        eventActions: [],
    };
    let currentSelection = { ...initialSelection };

    let globalInfo = {
        'consolidated-notes': '',
    };

    // --- DOM ELEMENTS ---
    const consolidatedNotesEl = document.getElementById('consolidated-notes') as HTMLTextAreaElement;
    const locationInputEl = document.getElementById('location-input') as HTMLInputElement;
    const addActivityBtn = document.getElementById('add-activity-btn') as HTMLButtonElement;
    const summaryListEl = document.getElementById('summary-list')!;
    
    const copyTextBtn = document.getElementById('copy-text-btn')!;
    const copyJsonBtn = document.getElementById('copy-json-btn')!;
    const resetBtn = document.getElementById('reset-btn')!;
    
    const showAddProductBtn = document.getElementById('show-add-product-btn') as HTMLButtonElement;
    const addProductForm = document.getElementById('add-product-form') as HTMLDivElement;
    const newProductInput = document.getElementById('new-product-input') as HTMLInputElement;
    const addProductBtn = document.getElementById('add-product-button') as HTMLButtonElement;


    // --- RENDER & UI FUNCTIONS ---
    function renderOptions(elementId: string, items: string[], category: keyof typeof initialSelection, multiSelect: boolean) {
        const groupEl = document.getElementById(elementId)!;
        groupEl.innerHTML = '';
        
        const methodButtonGroups = [
            'improvementMethod-group',
            'eventActions-group',
            'requestMethod-group',
            'requestMean-group',
            'otherActivityActions-group'
        ];
        const isMethodGroup = methodButtonGroups.includes(elementId);

        items.forEach(item => {
            const button = document.createElement('button');
            button.className = 'toggle-button';
            if (isMethodGroup) {
                button.classList.add('method-button');
            }
            button.textContent = item;
            button.dataset.value = item;
            
            button.addEventListener('click', () => {
                const value = button.dataset.value!;
                
                if (category === 'purpose') {
                    currentSelection.purpose = currentSelection.purpose === value ? '' : value;
                    updateVisibleSections();
                    updateButtonStates(elementId, [currentSelection.purpose], false);
                } else {
                    const selectionArray = currentSelection[category as keyof Omit<typeof initialSelection, 'purpose' | 'location'>];
                    if (multiSelect) {
                        if (selectionArray.includes(value)) {
                            const index = selectionArray.indexOf(value);
                            selectionArray.splice(index, 1);
                        } else {
                            selectionArray.push(value);
                        }
                    } else {
                        (currentSelection as any)[category] = selectionArray[0] === value ? [] : [value];
                    }
                    updateButtonStates(elementId, selectionArray, multiSelect);
                }
            });
            groupEl.appendChild(button);
        });
    }

    function updateButtonStates(elementId: string, selectedValues: string[], isMultiSelect: boolean) {
        const groupEl = document.getElementById(elementId)!;
        groupEl.querySelectorAll<HTMLButtonElement>('.toggle-button').forEach(btn => {
            if (selectedValues.includes(btn.dataset.value!)) {
                btn.classList.add('selected');
                btn.setAttribute('aria-pressed', 'true');
            } else {
                btn.classList.remove('selected');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
        addActivityBtn.disabled = !currentSelection.purpose;
    }

    function updateVisibleSections() {
        document.querySelectorAll<HTMLElement>('.sub-section').forEach(el => el.classList.add('hidden'));
        const commonContainer = document.getElementById('common-sections');

        if (currentSelection.purpose && PURPOSE_CONFIG[currentSelection.purpose]) {
            commonContainer?.classList.remove('hidden');
            const { sections } = PURPOSE_CONFIG[currentSelection.purpose];
            sections.forEach(sectionId => {
                document.getElementById(`${sectionId}-section`)?.classList.remove('hidden');
            });
        } else {
            commonContainer?.classList.add('hidden');
        }
    }

    function updateSummaryUI() {
        summaryListEl.innerHTML = '';
        activities.forEach(activity => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${activity.summary}</span>`;
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.setAttribute('aria-label', `Delete activity: ${activity.summary}`);
            deleteBtn.onclick = () => {
                activities = activities.filter(a => a.id !== activity.id);
                updateSummaryUI();
            };
            li.appendChild(deleteBtn);
            summaryListEl.appendChild(li);
        });
    }
    
    function resetCurrentSelection() {
        currentSelection = { ...initialSelection };
        locationInputEl.value = '';
        document.querySelectorAll('.toggle-button.selected').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-pressed', 'false');
        });
        updateVisibleSections();
        addActivityBtn.disabled = true;
    }

    function generateActivitySummary(selection: typeof currentSelection): { summary: string, data: Record<string, any> } {
        const parts = [selection.purpose];
        const data: Record<string, any> = { type: 'activity', purpose: selection.purpose };
        
        const config = PURPOSE_CONFIG[selection.purpose];
        if (!config) return { summary: '', data: {}};

        config.sections.forEach(key => {
            const value = selection[key as keyof typeof selection];
            if (Array.isArray(value) && value.length > 0) {
                parts.push(value.join(', '));
                data[key] = value;
            } else if (typeof value === 'string' && value) {
                parts.push(value);
                data[key] = value;
            }
        });

        if (config.specialText) {
            parts.push(config.specialText);
            data['specialText'] = config.specialText;
        }

        return { summary: parts.join(' / '), data };
    }

    // --- EVENT LISTENERS ---
    addActivityBtn.addEventListener('click', () => {
        if (!currentSelection.purpose || activities.length >= 6) {
            if (activities.length >= 6) alert('활동은 최대 6개까지 추가할 수 있습니다.');
            return;
        }
        const { summary, data } = generateActivitySummary(currentSelection);
        if (summary) {
            activities.push({ id: nextActivityId++, summary, data });
            updateSummaryUI();
            resetCurrentSelection();
        }
    });

    const handleAddNote = (event: MouseEvent) => {
        const button = event.currentTarget as HTMLButtonElement;
        const sourceId = button.dataset.sourceId as keyof typeof globalInfo;
        const label = button.dataset.label!;
        const textarea = document.getElementById(sourceId) as HTMLTextAreaElement;
        const text = textarea.value.trim();

        if (text && activities.length < 6) {
            const summary = `${label}: ${text}`;
            const data = { type: 'note', source: sourceId, text: text, label: label };
            activities.push({ id: nextActivityId++, summary, data });
            updateSummaryUI();

            // Clear the input
            textarea.value = '';
            globalInfo[sourceId] = '';
        } else if (activities.length >= 6) {
            alert('활동은 최대 6개까지 추가할 수 있습니다.');
        } else if (!text) {
            alert('내용을 입력해주세요.');
        }
    };

    document.querySelectorAll('.add-note-btn').forEach(btn => {
        btn.addEventListener('click', handleAddNote);
    });

    consolidatedNotesEl.addEventListener('input', () => { globalInfo['consolidated-notes'] = consolidatedNotesEl.value; });
    
    locationInputEl.addEventListener('input', () => {
        currentSelection.location = locationInputEl.value;
    });
    
    showAddProductBtn.addEventListener('click', () => {
        addProductForm.classList.toggle('hidden');
        if (!addProductForm.classList.contains('hidden')) {
            newProductInput.focus();
        }
    });

    addProductBtn.addEventListener('click', () => {
        const newProductName = newProductInput.value.trim();
        if (newProductName && !DATA.products.includes(newProductName)) {
            DATA.products.push(newProductName);
            saveProducts();
            renderOptions('products-group', DATA.products, 'products', true);

            // Automatically select the new product
            const selectionArray = currentSelection.products;
            if (!selectionArray.includes(newProductName)) {
                 selectionArray.push(newProductName);
            }
            updateButtonStates('products-group', selectionArray, true);
            
            newProductInput.value = '';
            addProductForm.classList.add('hidden');
        } else if (!newProductName) {
            alert('제품명을 입력해주세요.');
        } else {
            alert('이미 존재하는 제품입니다.');
        }
    });


    copyTextBtn.addEventListener('click', () => {
        if (activities.length === 0) {
            alert('추가된 활동내역이 없습니다.');
            return;
        }
        const textToCopy = activities.map(a => a.summary).join('\n');
        navigator.clipboard.writeText(textToCopy.trim()).then(() => alert('텍스트가 복사되었습니다.')).catch(() => alert('복사에 실패했습니다.'));
    });

    copyJsonBtn.addEventListener('click', () => {
        if (activities.length === 0) {
            alert('추가된 활동내역이 없습니다.');
            return;
        }
        const jsonToCopy = JSON.stringify(activities.map(a => a.data), null, 2);
        navigator.clipboard.writeText(jsonToCopy).then(() => alert('JSON이 복사되었습니다.')).catch(() => alert('복사에 실패했습니다.'));
    });
    
    resetBtn.addEventListener('click', () => {
        activities = [];
        nextActivityId = 0;
        
        globalInfo['consolidated-notes'] = '';
        consolidatedNotesEl.value = '';

        resetCurrentSelection();
        updateSummaryUI();
    });

    // --- INITIALIZATION ---
    function init() {
        renderOptions('purpose-group', DATA.purpose, 'purpose', false);
        renderOptions('displayType-group', DATA.displayTypes, 'displayType', true);
        renderOptions('products-group', DATA.products, 'products', true);
        renderOptions('improvementMethod-group', DATA.improvementMethods, 'improvementMethod', true);
        renderOptions('requestMethod-group', DATA.requestMethods, 'requestMethod', true);
        renderOptions('requestMean-group', DATA.requestMeans, 'requestMean', true);
        renderOptions('otherActivityActions-group', DATA.otherActivityActions, 'otherActivityActions', true);
        renderOptions('eventActions-group', DATA.eventActions, 'eventActions', true);

        updateSummaryUI();
    }



    init();
});
