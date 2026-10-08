const jsonInput = document.getElementById('jsonInput');
const startScreen = document.getElementById('startScreen');
const mainWorkspace = document.getElementById('mainWorkspace');
const nodesContainer = document.getElementById('nodesContainer');
const detailsModal = document.getElementById('detailsModal'); 

let scale = 1;
let translateX = 50;
let translateY = 50;
let isDragging = false;
let startX, startY;
const canvasContainer = document.getElementById('canvasContainer');
const canvasArea = document.getElementById('canvasArea');

jsonInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const rawData = JSON.parse(e.target.result);
            // Chuẩn hóa ép kiểu số nguyên
            const familyData = rawData.map(p => ({
                ...p,
                Generation: parseInt(p.Generation, 10) || 1 
            }));

            console.log("Dữ liệu đã tải:", familyData);
            window.familyTreeData = familyData; 

            startScreen.style.display = 'none';
            mainWorkspace.style.display = 'block';

            renderFamilyTree(familyData);
            resetView(); 
        } catch (error) {
            alert("Lỗi: File JSON không đúng định dạng. Vui lòng kiểm tra lại!");
            console.error(error);
        }
    };
    reader.readAsText(file);
});

// ==========================================
// CHỨC NĂNG ZOOM (Thu phóng) & PAN (Kéo thả)
// ==========================================
canvasContainer.addEventListener('wheel', (e) => {
    if(mainWorkspace.style.display === 'none') return;
    e.preventDefault();
    const zoomIntensity = 0.1;
    const delta = e.deltaY < 0 ? zoomIntensity : -zoomIntensity;
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.min(Math.max(0.1, scale + delta), 3); 
    const ratio = newScale / scale;
    
    translateX = mouseX - (mouseX - translateX) * ratio;
    translateY = mouseY - (mouseY - translateY) * ratio;
    scale = newScale;
    updateTransform();
}, { passive: false });

canvasContainer.addEventListener('mousedown', (e) => {
    if (e.target.closest('.person-node') || e.target.closest('#detailsModal') || e.target.closest('#toolbar')) return; 
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
});

window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
});

function updateTransform() {
    canvasArea.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
}

function resetView() {
    scale = 1; translateX = 50; translateY = 50;
    updateTransform();
}

// ==========================================
// CHỨC NĂNG TÌM KIẾM
// ==========================================
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

if (searchInput) {
    searchInput.addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        searchResults.innerHTML = '';
        if (!val || !window.familyTreeData) {
            searchResults.style.display = 'none'; return;
        }

        const matches = window.familyTreeData.filter(p => p.Name.toLowerCase().includes(val));
        if (matches.length > 0) {
            searchResults.style.display = 'block';
            matches.forEach(p => {
                const li = document.createElement('li');
                let subInfo = 'Đời: ' + (p.Generation || '?') + ' | ID: ' + p.ID;
                if (p.YearOfBirth) subInfo = '(' + p.YearOfBirth + ') - ' + subInfo;
                li.innerHTML = '<strong>' + p.Name + '</strong><span>' + subInfo + '</span>';
                li.addEventListener('click', () => {
                    searchInput.value = p.Name; searchResults.style.display = 'none'; focusOnNode(p.ID); 
                });
                searchResults.appendChild(li);
            });
        } else { searchResults.style.display = 'none'; }
    });
}

document.addEventListener('click', function(e) {
    if (searchResults && e.target !== searchInput) searchResults.style.display = 'none';
});

function focusOnNode(id) {
    document.querySelectorAll('.person-node').forEach(node => node.classList.remove('highlighted'));
    const targetNode = document.getElementById('node-' + id);
    if (targetNode) {
        targetNode.classList.add('highlighted');
        const containerRect = canvasContainer.getBoundingClientRect();
        const nodeX = targetNode.offsetLeft * scale;
        const nodeY = targetNode.offsetTop * scale;
        translateX = (containerRect.width / 2) - nodeX - ((targetNode.offsetWidth * scale) / 2);
        translateY = (containerRect.height / 2) - nodeY - ((targetNode.offsetHeight * scale) / 2);
        updateTransform();
    }
}

// ==========================================
// THUẬT TOÁN TỌA ĐỘ TỪ TRÊN XUỐNG DƯỚI (TOP-TO-BOTTOM)
// ==========================================
function renderFamilyTree(data) {
    const positions = calculatePositions(data);
    drawNodes(data, positions);
    // Timeout cho phép trình duyệt Render CSS, sau đó vẽ đường chỉ và ép chuẩn ISO
    setTimeout(() => { 
        applyISOCanvasAndCenter();
        drawConnections(data); 
    }, 100);
}

function calculatePositions(people) {
    if (!people || people.length === 0) return {};
    const childrenMap = {};
    const hasFather = new Set();
    const nodeDims = {};
    const depths = {};

    people.forEach(p => {
        if (p.FatherID && people.some(parent => String(parent.ID) === String(p.FatherID))) {
            const parentNode = people.find(parent => String(parent.ID) === String(p.FatherID));
            if (parentNode && parentNode.Gender && parentNode.Gender.toLowerCase() === 'nam') {
                if (!childrenMap[p.FatherID]) childrenMap[p.FatherID] = [];
                childrenMap[p.FatherID].push(p);
                hasFather.add(String(p.ID));
            }
        }
    });

    const roots = people.filter(p => !hasFather.has(String(p.ID)));

    // Bước 1: Tính toán Độ rộng (w) và Chiều cao (h) ảo của từng đối tượng
    const maxHAtDepth = {};
    const calcDepth = (nodeId, d) => {
        depths[nodeId] = d;
        const person = people.find(p => p.ID === String(nodeId));
        
        const isFounder = String(person.IsFounder) === '1';
        const gen = parseInt(person.Generation, 10) || 1;
        const isVertical = !isFounder && gen > 3;

        let w = 160, h = 70; // Chuẩn mặc định
        if (isFounder) {
            if (gen === 1) { w = 1280; h = 560; } // Gen 1 (X8)
            else { w = 640; h = 280; }            // Gen > 1 (X4)
        } else if (isVertical) {
            w = 60; h = 260; // Thẻ dọc hẹp ngang, cao dọc
        }

        nodeDims[nodeId] = { w, h };
        if (!maxHAtDepth[d] || h > maxHAtDepth[d]) maxHAtDepth[d] = h;
        (childrenMap[nodeId] || []).forEach(child => calcDepth(child.ID, d + 1));
    };
    roots.forEach(r => calcDepth(r.ID, 0));

    // Bước 2: Dàn lưới phân ranh giới trục Y
    const depthY = {};
    let currentY = 50;
    const GAP_Y = 80; // Khoảng cách dây nối dọc
    const maxDepth = Math.max(0, ...Object.values(depths));
    for (let i = 0; i <= maxDepth; i++) {
        depthY[i] = currentY;
        currentY += (maxHAtDepth[i] || 70) + GAP_Y;
    }

    const GAP_X = 40; // Khoảng cách giữa các anh em

    // Bước 3: Đệ quy tính toán trục X chống chồng lấp
    const layoutNode = (nodeId) => {
        const d = depths[nodeId];
        const dims = nodeDims[nodeId];
        const children = childrenMap[nodeId] || [];

        if (children.length === 0) {
            return { w: dims.w, contours: { [d]: { min: 0, max: dims.w } }, positions: { [nodeId]: 0 } };
        }

        const childLayouts = children.map(c => layoutNode(c.ID));
        const packedPositions = {};
        const mergedContours = {};
        let shift = 0;

        childLayouts.forEach((cl, index) => {
            let childShift = 0;
            if (index > 0) {
                Object.keys(cl.contours).forEach(level => {
                    if (mergedContours[level] && cl.contours[level]) {
                        const overlap = mergedContours[level].max + GAP_X - cl.contours[level].min;
                        if (overlap > childShift) childShift = overlap;
                    }
                });
                shift += childShift;
            }

            Object.keys(cl.positions).forEach(id => { packedPositions[id] = cl.positions[id] + shift; });
            Object.keys(cl.contours).forEach(level => {
                const minVal = cl.contours[level].min + shift;
                const maxVal = cl.contours[level].max + shift;
                if (!mergedContours[level]) mergedContours[level] = { min: minVal, max: maxVal };
                else {
                    mergedContours[level].min = Math.min(mergedContours[level].min, minVal);
                    mergedContours[level].max = Math.max(mergedContours[level].max, maxVal);
                }
            });
        });

        // Đặt thẻ cha nằm giữa nhóm thẻ con
        const firstChildId = children[0].ID;
        const lastChildId = children[children.length - 1].ID;
        const firstChildX = packedPositions[firstChildId];
        const lastChildX = packedPositions[lastChildId];
        const lastChildW = nodeDims[lastChildId].w;

        const centerChildrenX = firstChildX + (lastChildX + lastChildW - firstChildX) / 2;
        const parentX = centerChildrenX - (dims.w / 2);

        packedPositions[nodeId] = parentX;
        if (!mergedContours[d]) mergedContours[d] = { min: parentX, max: parentX + dims.w };
        else {
            mergedContours[d].min = Math.min(mergedContours[d].min, parentX);
            mergedContours[d].max = Math.max(mergedContours[d].max, parentX + dims.w);
        }

        const minX = Math.min(...Object.values(mergedContours).map(c => c.min));
        if (minX < 0) {
            const adjust = -minX;
            Object.keys(packedPositions).forEach(id => packedPositions[id] += adjust);
            Object.keys(mergedContours).forEach(level => {
                mergedContours[level].min += adjust;
                mergedContours[level].max += adjust;
            });
        }
        return { w: dims.w, contours: mergedContours, positions: packedPositions };
    };

    const finalPositions = {};
    let globalShift = 50;
    const globalContours = {};

    roots.forEach((root, idx) => {
        const layout = layoutNode(root.ID);
        let shift = 0;
        if (idx > 0) {
            Object.keys(layout.contours).forEach(level => {
                if (globalContours[level] && layout.contours[level]) {
                    const overlap = globalContours[level].max + GAP_X * 2 - layout.contours[level].min;
                    if (overlap > shift) shift = overlap;
                }
            });
        }
        globalShift += shift;

        Object.keys(layout.positions).forEach(id => {
            finalPositions[id] = { x: layout.positions[id] + globalShift, y: depthY[depths[id]], depth: depths[id], dims: nodeDims[id] };
        });

        Object.keys(layout.contours).forEach(level => {
            const maxVal = layout.contours[level].max + globalShift;
            if (!globalContours[level]) globalContours[level] = { max: maxVal };
            else globalContours[level].max = Math.max(globalContours[level].max, maxVal);
        });

        if(idx === 0) {
             globalShift = Math.max(globalShift, Math.max(...Object.values(layout.contours).map(c => c.max)) + GAP_X * 2);
        }
    });

    return finalPositions;
}

function drawNodes(data, positions) {
    nodesContainer.innerHTML = ''; 
    
    const getFatherName = (fatherId) => {
        if (!fatherId) return 'Cụ Tổ';
        const father = data.find((p) => String(p.ID) === String(fatherId));
        return father ? father.Name : 'Chưa rõ';
    };

    const getChildrenNames = (childrenIds) => {
        if (!childrenIds) return 'Không có con';
        const idsArray = Array.isArray(childrenIds) ? childrenIds : String(childrenIds).split(',');
        const validIds = idsArray.map(id => String(id).trim()).filter(id => id !== '');
        if (validIds.length === 0) return 'Không có con';
        return validIds.map((childId) => {
            const child = data.find((p) => String(p.ID) === childId);
            return child ? child.Name : childId;
        }).join(', ');
    };

    data.forEach(person => {
        const pos = positions[person.ID];
        if (!pos) return;

        const node = document.createElement('div');
        node.className = 'person-node';
        node.id = 'node-' + person.ID; 
        
        const isFounder = String(person.IsFounder) === '1';
        const gen = parseInt(person.Generation, 10) || 1;
        const isVertical = !isFounder && gen > 3;

        // Phân lớp giao diện
        if (isFounder) {
            if (gen === 1) node.classList.add('founder-gen-1');
            else node.classList.add('founder-gen-n');
        } else if (isVertical) {
            node.classList.add('vertical-node');
        }

        node.style.left = pos.x + 'px';
        node.style.top = pos.y + 'px';

        const genderClass = (person.Gender && person.Gender.toLowerCase() === 'nữ') ? 'gender-female' : 'gender-male';

        let nodeHTML = '<div class="node-name ' + genderClass + '">' + person.Name + '</div>';
        if (!isFounder && person.Spouse && person.Gender && person.Gender.toLowerCase() === 'nam') {
            nodeHTML += '<div class="node-spouse">' + person.Spouse + '</div>';
        }
        
        node.innerHTML = nodeHTML;
        
        const openModalHandler = function(e) {
            e.preventDefault(); 
            let html = `
            <div class="modal-overlay" id="modalOverlay">
              <div class="modal-content" id="modalContent">
                <h2>${person.Name}</h2>
                <form onsubmit="event.preventDefault()">
                  <div class="form-row">
                    <div class="form-group"><label>Năm sinh:</label><input type="text" value="${person.YearOfBirth || 'Chưa rõ'}" readonly></div>
                    <div class="form-group"><label>Năm mất:</label><input type="text" value="${person.YearOfDeath || 'Chưa rõ'}" readonly></div>
                  </div>
                  <div class="form-row">
                    <div class="form-group"><label>Giới tính:</label><input type="text" value="${person.Gender || 'Nam'}" readonly></div>
                    ${!isFounder ? `<div class="form-group"><label>Đời thứ:</label><input type="text" value="${person.Generation || ''}" readonly></div>` : '<div class="form-group"></div>'}
                  </div>
                  <div class="form-group"><label>Cha:</label><input type="text" value="${getFatherName(person.FatherID)}" readonly></div>`;

            if (!isFounder && person.Gender && person.Gender.toLowerCase() === 'nam') {
                html += `
                  <div class="form-group"><label>Vợ:</label><input type="text" value="${person.Spouse || 'Không có thông tin vợ'}" readonly></div>
                  <div class="form-group"><label>Con cái:</label><textarea readonly rows="2">${getChildrenNames(person.ChildID)}</textarea></div>`;
            }

            html += `<div class="form-group"><label>Tiểu sử:</label><textarea readonly rows="4">${person.Biography || 'Không có thông tin tiểu sử.'}</textarea></div>
                </form></div></div>`;

            detailsModal.innerHTML = html;
            detailsModal.style.display = 'block';

            document.getElementById('modalOverlay').addEventListener('click', function() { detailsModal.style.display = 'none'; detailsModal.innerHTML = ''; });
            document.getElementById('modalContent').addEventListener('click', function(e) { e.stopPropagation(); });
        };

        node.addEventListener('contextmenu', openModalHandler);
        node.addEventListener('click', openModalHandler);
        nodesContainer.appendChild(node);
    });
}

function applyISOCanvasAndCenter() {
    let maxX = 0, maxY = 0;
    document.querySelectorAll('.person-node').forEach(node => {
        const right = node.offsetLeft + node.offsetWidth;
        const bottom = node.offsetTop + node.offsetHeight;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
    });

    const PADDING = 200; // Viền an toàn
    const targetW = maxX + PADDING;
    const targetH = maxY + PADDING;
    const ISO_RATIO = 1.41421356; // Chuẩn A0, A1, A2...

    let finalW = targetW;
    let finalH = targetH;
    
    // Thuật toán ép Canvas về đúng Tỉ lệ Vàng ISO 216
    if (targetW > targetH) { // Định dạng khổ Ngang (Landscape)
        if (targetW / targetH < ISO_RATIO) finalW = targetH * ISO_RATIO;
        else finalH = targetW / ISO_RATIO;
    } else { // Định dạng khổ Dọc (Portrait)
        if (targetH / targetW < ISO_RATIO) finalH = targetW * ISO_RATIO;
        else finalW = targetH / ISO_RATIO;
    }

    canvasArea.style.width = finalW + 'px';
    canvasArea.style.height = finalH + 'px';

    // Dịch chuyển đẩy toàn bộ Node ra chính giữa tờ giấy (Căn lề)
    const offsetX = (finalW - targetW + PADDING) / 2;
    const offsetY = (finalH - targetH + PADDING) / 2;

    if (offsetX > 0 || offsetY > 0) {
        document.querySelectorAll('.person-node').forEach(node => {
            node.style.left = (node.offsetLeft + offsetX) + 'px';
            node.style.top = (node.offsetTop + offsetY) + 'px';
        });
    }
}

function drawConnections(data) {
    const svg = document.getElementById('connectionLines');
    svg.innerHTML = ''; 

    data.forEach(person => {
        if (person.FatherID) {
            const fatherNode = document.getElementById('node-' + person.FatherID);
            const childNode = document.getElementById('node-' + person.ID);

            if (fatherNode && childNode) {
                // TỌA ĐỘ VẼ MÓC TỪ TRÊN XUỐNG DƯỚI
                const startX = fatherNode.offsetLeft + (fatherNode.offsetWidth / 2);
                const startY = fatherNode.offsetTop + fatherNode.offsetHeight;

                const endX = childNode.offsetLeft + (childNode.offsetWidth / 2);
                const endY = childNode.offsetTop;

                const midY = startY + (endY - startY) / 2;

                // Nối Móc vuông góc: Đi xuống giữa -> Rẽ sang ngang -> Đi xuống tiếp vào con
                const pathData = 'M ' + startX + ' ' + startY + ' L ' + startX + ' ' + midY + ' L ' + endX + ' ' + midY + ' L ' + endX + ' ' + endY;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathData);
                path.setAttribute('stroke', '#666');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');

                svg.appendChild(path);
            }
        }
    });
}

// ==========================================
// CHỨC NĂNG XUẤT PDF
// ==========================================
function exportPDF() {
    const exportBtn = document.getElementById('exportBtn');
    const originalText = exportBtn.innerText;
    exportBtn.innerText = 'Đang xử lý ảnh nét...'; 
    exportBtn.style.backgroundColor = '#95a5a6';
    exportBtn.disabled = true;

    const canvasArea = document.getElementById('canvasArea');
    canvasArea.style.margin = '0px';
    canvasArea.style.boxShadow = 'none';
    canvasArea.style.transform = 'none'; 
    
    const allNodes = document.querySelectorAll('.person-node');
    allNodes.forEach(node => {
        node.classList.remove('highlighted');
        node.style.boxShadow = 'none'; 
    });

    const rect = canvasArea.getBoundingClientRect();
    const pdfWidth = rect.width;
    const pdfHeight = rect.height;

    const opt = {
        margin:       0,
        filename:     'PhaDoGiaToc.pdf',
        image:        { type: 'jpeg', quality: 1 }, 
        html2canvas:  { 
            scale: 3, 
            useCORS: true, 
            logging: false,
            scrollX: 0, 
            scrollY: 0,
            width: pdfWidth, 
            height: pdfHeight 
        },
        jsPDF: { unit: 'px', format: [pdfWidth, pdfHeight], orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait' } 
    };

    html2pdf().set(opt).from(canvasArea).save().then(() => {
        canvasArea.style.margin = ''; canvasArea.style.boxShadow = ''; 
        allNodes.forEach(node => { node.style.boxShadow = ''; });
        updateTransform(); 
        exportBtn.innerText = originalText; exportBtn.style.backgroundColor = '#e74c3c'; exportBtn.disabled = false;
    }).catch(err => {
        console.error("Lỗi khi xuất PDF:", err);
        alert('Có lỗi xảy ra khi xuất PDF. Dung lượng quá lớn có thể cần làm trên máy tính có RAM mạnh hơn.');
        canvasArea.style.margin = ''; canvasArea.style.boxShadow = ''; 
        allNodes.forEach(node => { node.style.boxShadow = ''; });
        updateTransform();
        exportBtn.innerText = originalText; exportBtn.style.backgroundColor = '#e74c3c'; exportBtn.disabled = false;
    });
}