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
            const familyData = JSON.parse(e.target.result);
            window.familyTreeData = familyData.map(p => ({
                ...p, Generation: parseInt(p.Generation, 10) || 1 
            }));
            startScreen.style.display = 'none';
            mainWorkspace.style.display = 'block';
            renderFamilyTree(window.familyTreeData);
        } catch (error) {
            alert("Lỗi: File JSON không đúng định dạng. Vui lòng kiểm tra lại!");
        }
    };
    reader.readAsText(file);
});

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

window.resetView = function() {
    scale = 1; 
    const rootNode = document.querySelector('.founder-gen-1') || document.querySelector('.person-node');
    if (rootNode) {
        const containerRect = canvasContainer.getBoundingClientRect();
        // Căn Cụ Tổ ra giữa không gian làm việc của người dùng
        translateX = (containerRect.width / 2) - rootNode.offsetLeft - (rootNode.offsetWidth / 2);
        translateY = 80 - rootNode.offsetTop; 
    } else {
        translateX = 50; translateY = 50; 
    }
    updateTransform();
}

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        searchResults.innerHTML = '';
        if (!val || !window.familyTreeData) { searchResults.style.display = 'none'; return; }
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

function renderFamilyTree(data) {
    const positions = calculatePositions(data);
    drawNodes(data, positions);
}

function calculatePositions(people) {
    if (!people || people.length === 0) return {};
    const pos = {};
    const allIds = new Set(people.map(p => String(p.ID)));
    const childrenMap = {};
    const hasFather = new Set();
    const nodeDims = {}; 
    const depths = {};
    
    people.forEach(p => {
        if (p.FatherID && allIds.has(String(p.FatherID))) {
            const parentNode = people.find(parent => String(parent.ID) === String(p.FatherID));
            if (parentNode && parentNode.Gender && parentNode.Gender.toLowerCase() === 'nam') {
                if (!childrenMap[p.FatherID]) childrenMap[p.FatherID] = [];
                childrenMap[p.FatherID].push(p);
                hasFather.add(String(p.ID));
            }
        }
    });

    const roots = people.filter(p => !hasFather.has(String(p.ID)));

    people.forEach(p => {
        const isFounder = String(p.IsFounder) === '1';
        const gen = parseInt(p.Generation, 10) || 1;
        const isVertical = !isFounder && gen > 3; 
        
        if (isFounder) {
            if (gen === 1) nodeDims[p.ID] = { w: 560, h: 180 }; 
            else nodeDims[p.ID] = { w: 180, h: 70 }; 
        } else if (isVertical) {
            nodeDims[p.ID] = { w: 55, h: 250 }; 
        } else {
            nodeDims[p.ID] = { w: 150, h: 70 }; 
        }
    });
    
    const maxHAtDepth = {};
    const calcDepth = (nodeId, d) => {
        depths[nodeId] = d;
        const h = nodeDims[nodeId].h;
        if (!maxHAtDepth[d] || h > maxHAtDepth[d]) maxHAtDepth[d] = h;
        (childrenMap[nodeId] || []).forEach(child => calcDepth(child.ID, d + 1));
    };
    roots.forEach(r => calcDepth(r.ID, 0));

    const depthY = {};
    let currentY = 50;
    const GAP_Y = 80; // Khoảng cách cố định giữa các thế hệ
    const maxDepth = Math.max(0, ...Object.values(depths));
    for (let i = 0; i <= maxDepth; i++) {
        depthY[i] = currentY;
        currentY += (maxHAtDepth[i] || 70) + GAP_Y;
    }

    const GAP_X = 20; 
    const INITIAL_X = 50;

    const layoutSubtree = (personId, depth) => {
        const myWidth = nodeDims[personId].w;
        const subPos = { [personId]: { x: 0, y: depthY[depth] } };
        const subContours = { [depth]: { min: 0, max: myWidth } };
        const children = childrenMap[personId] || [];
        
        if (children.length === 0) return { positions: subPos, contours: subContours };

        const childrenLayouts = children.map(child => layoutSubtree(child.ID, depth + 1));
        const packedChildrenPos = {};
        const cumulativeContours = {};

        childrenLayouts.forEach((childLayout, index) => {
            let shift = 0;
            if (index > 0) {
                Object.keys(childLayout.contours).forEach(depthStr => {
                    const d = parseInt(depthStr, 10);
                    if (cumulativeContours[d] && childLayout.contours[d]) {
                        const overlapShift = cumulativeContours[d].max + GAP_X - childLayout.contours[d].min;
                        if (overlapShift > shift) shift = overlapShift;
                    }
                });
            }
            Object.keys(childLayout.positions).forEach(id => {
                packedChildrenPos[id] = { x: childLayout.positions[id].x + shift, y: childLayout.positions[id].y };
            });
            Object.keys(childLayout.contours).forEach(depthStr => {
                const d = parseInt(depthStr, 10);
                const minVal = childLayout.contours[d].min + shift;
                const maxVal = childLayout.contours[d].max + shift;
                if (!cumulativeContours[d]) {
                    cumulativeContours[d] = { min: minVal, max: maxVal };
                } else {
                    cumulativeContours[d].min = Math.min(cumulativeContours[d].min, minVal);
                    cumulativeContours[d].max = Math.max(cumulativeContours[d].max, maxVal);
                }
            });
        });

        const firstChildId = children[0].ID;
        const lastChildId = children[children.length - 1].ID;
        const firstChildX = packedChildrenPos[firstChildId].x;
        const lastChildX = packedChildrenPos[lastChildId].x;
        const lastChildW = nodeDims[lastChildId].w;
        
        const centerChildrenX = (firstChildX + lastChildX + lastChildW) / 2;
        const targetParentX = centerChildrenX - (myWidth / 2); 
        
        const childrenShift = -targetParentX; 

        Object.keys(packedChildrenPos).forEach(id => {
            subPos[id] = { x: packedChildrenPos[id].x + childrenShift, y: packedChildrenPos[id].y };
        });
        
        Object.keys(cumulativeContours).forEach(depthStr => {
            const d = parseInt(depthStr, 10);
            const minVal = cumulativeContours[d].min + childrenShift;
            const maxVal = cumulativeContours[d].max + childrenShift;
            if (!subContours[d]) {
                subContours[d] = { min: minVal, max: maxVal };
            } else {
                subContours[d].min = Math.min(subContours[d].min, minVal);
                subContours[d].max = Math.max(subContours[d].max, maxVal);
            }
        });
        
        if (!subContours[depth]) subContours[depth] = { min: 0, max: myWidth };
        else {
            subContours[depth].min = Math.min(subContours[depth].min, 0);
            subContours[depth].max = Math.max(subContours[depth].max, myWidth);
        }

        return { positions: subPos, contours: subContours };
    };

    const globalContours = {};
    let currentGlobalShift = INITIAL_X;

    roots.forEach((root, index) => {
        const rootLayout = layoutSubtree(root.ID, 0); 
        let shift = currentGlobalShift;

        if (index > 0) {
            let maxOverlapShift = currentGlobalShift;
            Object.keys(rootLayout.contours).forEach(depthStr => {
                const d = parseInt(depthStr, 10);
                if (globalContours[d] && rootLayout.contours[d]) {
                    const neededShift = globalContours[d].max + GAP_X - rootLayout.contours[d].min;
                    if (neededShift > maxOverlapShift) maxOverlapShift = neededShift;
                }
            });
            shift = maxOverlapShift;
        } else {
            let minSubX = Infinity;
            Object.keys(rootLayout.positions).forEach(id => {
                if (rootLayout.positions[id].x < minSubX) minSubX = rootLayout.positions[id].x;
            });
            if (minSubX < 0) shift = INITIAL_X - minSubX;
        }

        Object.keys(rootLayout.positions).forEach(id => {
            pos[id] = { x: rootLayout.positions[id].x + shift, y: rootLayout.positions[id].y };
        });
        Object.keys(rootLayout.contours).forEach(depthStr => {
            const d = parseInt(depthStr, 10);
            const minVal = rootLayout.contours[d].min + shift;
            const maxVal = rootLayout.contours[d].max + shift;
            if (!globalContours[d]) {
                globalContours[d] = { min: minVal, max: maxVal };
            } else {
                globalContours[d].min = Math.min(globalContours[d].min, minVal);
                globalContours[d].max = Math.max(globalContours[d].max, maxVal);
            }
        });
        if (globalContours[0]) currentGlobalShift = globalContours[0].max + GAP_X;
    });

    return pos;
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
        
        if (isVertical) {
            node.innerHTML = '<div class="vertical-wrapper">' + nodeHTML + '</div>';
        } else {
            node.innerHTML = nodeHTML;
        }
        
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

            html += `
                  <div class="form-group"><label>Tiểu sử:</label><textarea readonly rows="4">${person.Biography || 'Không có thông tin tiểu sử.'}</textarea></div>
                </form></div></div>`;
            detailsModal.innerHTML = html;
            detailsModal.style.display = 'block';
            document.getElementById('modalOverlay').addEventListener('click', function() { detailsModal.style.display = 'none'; });
            document.getElementById('modalContent').addEventListener('click', function(e) { e.stopPropagation(); });
        };

        node.addEventListener('contextmenu', openModalHandler);
        node.addEventListener('click', openModalHandler);
        nodesContainer.appendChild(node);
    });

    setTimeout(() => {
        let minX = Infinity, minY = Infinity;
        let maxX = 0, maxY = 0;
        const allNodes = document.querySelectorAll('.person-node');
        
        // Quét đo đạc biên giới thực tế bọc sát gia phả
        allNodes.forEach(node => {
            if (node.offsetLeft < minX) minX = node.offsetLeft;
            if (node.offsetTop < minY) minY = node.offsetTop;
            const right = node.offsetLeft + node.offsetWidth;
            const bottom = node.offsetTop + node.offsetHeight;
            if (right > maxX) maxX = right;
            if (bottom > maxY) maxY = bottom;
        });

        // Bỏ logic "maxDist * 2", ôm sát rịt lấy chiều rộng và cao của cây
        const contentW = maxX - minX; 
        const contentH = maxY - minY;
        
        const PADDING = 80; // Giảm lề thừa từ 250px xuống còn 80px
        const targetW = contentW + PADDING * 2;
        const targetH = contentH + PADDING * 2;
        const ISO_RATIO = 1.41421356; 

        let finalW = targetW;
        let finalH = targetH;
        
        // Tính toán lấp đầy ISO 216 để xuất PDF chuẩn A0/A1
        if (targetW > targetH) { 
            if (targetW / targetH < ISO_RATIO) finalW = targetH * ISO_RATIO;
            else finalH = targetW / ISO_RATIO;
        } else { 
            if (targetH / targetW < ISO_RATIO) finalH = targetW * ISO_RATIO;
            else finalW = targetH / ISO_RATIO;
        }

        canvasArea.style.width = finalW + 'px';
        canvasArea.style.height = finalH + 'px';

        // Tính toán vector dịch chuyển đặt gia phả vào trung tâm tờ giấy
        const shiftX = (finalW - contentW) / 2 - minX;
        const shiftY = (finalH - contentH) / 2 - minY;

        allNodes.forEach(node => {
            node.style.left = (node.offsetLeft + shiftX) + 'px';
            node.style.top = (node.offsetTop + shiftY) + 'px';
        });

        // Tuyệt đối không ép Cụ Tổ ra giữa một cách độc đoán nữa, 
        // bản thân thuật toán layoutSubtree đã tự động đưa Cha đứng giữa tập hợp các Con rồi.
        drawConnections(data);
        window.resetView();

    }, 50);
}

function drawConnections(data) {
    const svg = document.getElementById('connectionLines');
    svg.innerHTML = ''; 

    data.forEach(person => {
        if (person.FatherID) {
            const fatherNode = document.getElementById('node-' + person.FatherID);
            const childNode = document.getElementById('node-' + person.ID);

            if (fatherNode && childNode) {
                const startX = fatherNode.offsetLeft + (fatherNode.offsetWidth / 2);
                const startY = fatherNode.offsetTop + fatherNode.offsetHeight;
                const endX = childNode.offsetLeft + (childNode.offsetWidth / 2);
                const endY = childNode.offsetTop;
                const midY = startY + (endY - startY) / 2;

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

function exportPDF() {
    const exportBtn = document.getElementById('exportBtn');
    const originalText = exportBtn.innerText;
    exportBtn.innerText = 'Đang xử lý ảnh nét...'; 
    exportBtn.style.backgroundColor = '#95a5a6';
    exportBtn.disabled = true;

    const canvasArea = document.getElementById('canvasArea');
    const originalMargin = canvasArea.style.margin;
    const originalBoxShadow = canvasArea.style.boxShadow;
    const originalTransform = canvasArea.style.transform;

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

    htmlToImage.toJpeg(canvasArea, {
        quality: 0.98,
        backgroundColor: '#ffffff', 
        pixelRatio: 2,
        width: pdfWidth,
        height: pdfHeight,
        style: {
            transform: 'none',
            transformOrigin: 'top left',
            margin: '0'
        }
    })
    .then(function (dataUrl) {
        const { jsPDF } = window.jspdf;
        const orientation = pdfWidth > pdfHeight ? 'landscape' : 'portrait';
        const doc = new jsPDF({
            orientation: orientation,
            unit: 'px',
            format: [pdfWidth, pdfHeight]
        });

        doc.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        doc.save('PhaDoGiaToc.pdf');

        canvasArea.style.margin = originalMargin; 
        canvasArea.style.boxShadow = originalBoxShadow; 
        canvasArea.style.transform = originalTransform;
        allNodes.forEach(node => { node.style.boxShadow = ''; });
        
        exportBtn.innerText = originalText; 
        exportBtn.style.backgroundColor = '#60d3f7'; 
        exportBtn.disabled = false;
    })
    .catch(function (error) {
        console.error("Lỗi khi xuất PDF:", error); 
        alert('Có lỗi xảy ra khi chụp ảnh màn hình.');
        
        canvasArea.style.margin = originalMargin; 
        canvasArea.style.boxShadow = originalBoxShadow; 
        canvasArea.style.transform = originalTransform;
        allNodes.forEach(node => { node.style.boxShadow = ''; });
        
        exportBtn.innerText = originalText; 
        exportBtn.style.backgroundColor = '#60d3f7'; 
        exportBtn.disabled = false;
    });
}
