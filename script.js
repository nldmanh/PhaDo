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

window.addEventListener('mouseup', () => {
    isDragging = false;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
});

function updateTransform() {
    // SỬ DỤNG CỘNG CHUỖI ĐỂ TRÁNH LỖI SAO CHÉP
    canvasArea.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
}

function resetView() {
    scale = 1;
    translateX = 50; 
    translateY = 50;
    updateTransform();
}

// ==========================================
// CHỨC NĂNG TÌM KIẾM (Live Search Dropdown)
// ==========================================
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

if (searchInput) {
    searchInput.addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        searchResults.innerHTML = '';
        
        if (!val || !window.familyTreeData) {
            searchResults.style.display = 'none';
            return;
        }

        // Lọc dữ liệu theo tên
        const matches = window.familyTreeData.filter(p => p.Name.toLowerCase().includes(val));
        
        if (matches.length > 0) {
            searchResults.style.display = 'block';
            matches.forEach(p => {
                const li = document.createElement('li');
                
                // Chuẩn bị thông tin phụ (Đời, Năm sinh, ID)
                let subInfo = 'Đời: ' + (p.Generation || '?') + ' | ID: ' + p.ID;
                if (p.YearOfBirth) {
                    subInfo = '(' + p.YearOfBirth + ') - ' + subInfo;
                }

                li.innerHTML = '<strong>' + p.Name + '</strong><span>' + subInfo + '</span>';
                
                // Sự kiện khi click chọn người trong danh sách
                li.addEventListener('click', () => {
                    searchInput.value = p.Name; // Điền tên lên ô input
                    searchResults.style.display = 'none'; // Ẩn danh sách
                    focusOnNode(p.ID); // Căn giữa màn hình vào người này
                });
                
                searchResults.appendChild(li);
            });
        } else {
            searchResults.style.display = 'none';
        }
    });
}

// Ẩn danh sách tìm kiếm khi bấm ra ngoài
document.addEventListener('click', function(e) {
    if (searchResults && e.target !== searchInput) {
        searchResults.style.display = 'none';
    }
});

// Hàm làm nổi bật và căn giữa Node
function focusOnNode(id) {
    // Xóa nổi bật cũ
    document.querySelectorAll('.person-node').forEach(node => node.classList.remove('highlighted'));
    
    // Tạo ID dạng chuỗi an toàn
    const targetNode = document.getElementById('node-' + id);
    
    if (targetNode) {
        targetNode.classList.add('highlighted');
        
        // Tính toán để căn giữa màn hình dựa trên tỷ lệ Scale hiện tại
        const containerRect = canvasContainer.getBoundingClientRect();
        const nodeX = targetNode.offsetLeft * scale;
        const nodeY = targetNode.offsetTop * scale;
        
        translateX = (containerRect.width / 2) - nodeX - ((targetNode.offsetWidth * scale) / 2);
        translateY = (containerRect.height / 2) - nodeY - ((targetNode.offsetHeight * scale) / 2);
        
        updateTransform();
    }
}

// ==========================================
// CÁC HÀM VẼ PHẢ ĐỒ 
// ==========================================

function renderFamilyTree(data) {
    const positions = calculatePositions(data);
    drawNodes(data, positions);
    
    setTimeout(() => {
        drawConnections(data);
    }, 50);
}

function calculatePositions(people) {
    if (!people || people.length === 0) return {};
    const pos = {};
    const allIds = new Set(people.map(p => String(p.ID)));
    const childrenMap = {};
    const hasFather = new Set();
    
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
    const distanceY = 160; 
    const distanceX = 220; 
    const INITIAL_Y = 50;

    const layoutSubtree = (personId, currentGen) => {
        const subPos = { [personId]: { y: currentGen * distanceY + INITIAL_Y, x: 0 } };
        const subContours = { [currentGen]: { min: 0, max: 0 } };
        const children = childrenMap[personId] || [];
        if (children.length === 0) return { positions: subPos, contours: subContours };

        const childrenLayouts = children.map(child => layoutSubtree(child.ID, currentGen + 1));
        const packedChildrenPos = {};
        const cumulativeContours = {};

        childrenLayouts.forEach((childLayout, index) => {
            let shift = 0;
            if (index > 0) {
                Object.keys(childLayout.contours).forEach(genStr => {
                    const gen = parseInt(genStr, 10);
                    if (cumulativeContours[gen] && childLayout.contours[gen]) {
                        const overlapShift = cumulativeContours[gen].max + distanceX - childLayout.contours[gen].min;
                        if (overlapShift > shift) shift = overlapShift;
                    }
                });
            }
            Object.keys(childLayout.positions).forEach(id => {
                packedChildrenPos[id] = { y: childLayout.positions[id].y, x: childLayout.positions[id].x + shift };
            });
            Object.keys(childLayout.contours).forEach(genStr => {
                const gen = parseInt(genStr, 10);
                const minVal = childLayout.contours[gen].min + shift;
                const maxVal = childLayout.contours[gen].max + shift;
                if (!cumulativeContours[gen]) {
                    cumulativeContours[gen] = { min: minVal, max: maxVal };
                } else {
                    cumulativeContours[gen].min = Math.min(cumulativeContours[gen].min, minVal);
                    cumulativeContours[gen].max = Math.max(cumulativeContours[gen].max, maxVal);
                }
            });
        });

        const firstChildX = packedChildrenPos[children[0].ID].x;
        const lastChildX = packedChildrenPos[children[children.length - 1].ID].x;
        const targetParentX = (firstChildX + lastChildX) / 2;
        const childrenShift = -targetParentX;

        Object.keys(packedChildrenPos).forEach(id => {
            subPos[id] = { y: packedChildrenPos[id].y, x: packedChildrenPos[id].x + childrenShift };
        });
        Object.keys(cumulativeContours).forEach(genStr => {
            const gen = parseInt(genStr, 10);
            const minVal = cumulativeContours[gen].min + childrenShift;
            const maxVal = cumulativeContours[gen].max + childrenShift;
            if (!subContours[gen]) {
                subContours[gen] = { min: minVal, max: maxVal };
            } else {
                subContours[gen].min = Math.min(subContours[gen].min, minVal);
                subContours[gen].max = Math.max(subContours[gen].max, maxVal);
            }
        });
        return { positions: subPos, contours: subContours };
    };

    const globalContours = {};
    let currentGlobalShift = 50;

    roots.forEach((root, index) => {
        const rootGen = root.Generation || 1;
        const rootLayout = layoutSubtree(root.ID, rootGen);
        let shift = currentGlobalShift;

        if (index > 0) {
            let maxOverlapShift = currentGlobalShift;
            Object.keys(rootLayout.contours).forEach(genStr => {
                const gen = parseInt(genStr, 10);
                if (globalContours[gen] && rootLayout.contours[gen]) {
                    const neededShift = globalContours[gen].max + distanceX - rootLayout.contours[gen].min;
                    if (neededShift > maxOverlapShift) maxOverlapShift = neededShift;
                }
            });
            shift = maxOverlapShift;
        } else {
            let minSubX = Infinity;
            Object.keys(rootLayout.positions).forEach(id => {
                if (rootLayout.positions[id].x < minSubX) minSubX = rootLayout.positions[id].x;
            });
            if (minSubX < 0) shift = 50 - minSubX;
        }

        Object.keys(rootLayout.positions).forEach(id => {
            pos[id] = { y: rootLayout.positions[id].y, x: rootLayout.positions[id].x + shift };
        });
        Object.keys(rootLayout.contours).forEach(genStr => {
            const gen = parseInt(genStr, 10);
            const minVal = rootLayout.contours[gen].min + shift;
            const maxVal = rootLayout.contours[gen].max + shift;
            if (!globalContours[gen]) {
                globalContours[gen] = { min: minVal, max: maxVal };
            } else {
                globalContours[gen].min = Math.min(globalContours[gen].min, minVal);
                globalContours[gen].max = Math.max(globalContours[gen].max, maxVal);
            }
        });
        if (globalContours[rootGen]) currentGlobalShift = globalContours[rootGen].max + distanceX;
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
        if (!childrenIds || childrenIds.length === 0) return 'Không có con';
        return childrenIds
            .map((childId) => {
                const child = data.find((p) => String(p.ID) === String(childId));
                return child ? child.Name : childId;
            })
            .join(', ');
    };

    data.forEach(person => {
        const pos = positions[person.ID];
        if (!pos) return;

        const node = document.createElement('div');
        node.className = 'person-node';
        node.id = 'node-' + person.ID; // Chuyển sang nối chuỗi an toàn
        
        node.style.left = pos.x + 'px';
        node.style.top = pos.y + 'px';

        const genderClass = (person.Gender && person.Gender.toLowerCase() === 'nữ') ? 'gender-female' : 'gender-male';

        let nodeHTML = '<div class="node-name ' + genderClass + '">' + person.Name + '</div>';
        
        if (person.Spouse && person.Gender && person.Gender.toLowerCase() === 'nam') {
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
                    <div class="form-group">
                      <label>Năm sinh:</label>
                      <input type="text" value="${person.YearOfBirth || 'Chưa rõ'}" readonly>
                    </div>
                    <div class="form-group">
                      <label>Năm mất:</label>
                      <input type="text" value="${person.YearOfDeath || 'Chưa rõ'}" readonly>
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>Giới tính:</label>
                      <input type="text" value="${person.Gender || 'Nam'}" readonly>
                    </div>
                    <div class="form-group">
                      <label>Đời thứ:</label>
                      <input type="text" value="${person.Generation || ''}" readonly>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Cha:</label>
                    <input type="text" value="${getFatherName(person.FatherID)}" readonly>
                  </div>`;

            if (person.Gender && person.Gender.toLowerCase() === 'nam') {
                html += `
                  <div class="form-group">
                    <label>Vợ:</label>
                    <input type="text" value="${person.Spouse || 'Không có thông tin vợ'}" readonly>
                  </div>
                  <div class="form-group">
                    <label>Con cái:</label>
                    <textarea readonly rows="2">${getChildrenNames(person.ChildID)}</textarea>
                  </div>`;
            }

            html += `
                  <div class="form-group">
                    <label>Tiểu sử:</label>
                    <textarea readonly rows="4">${person.Biography || 'Không có thông tin tiểu sử.'}</textarea>
                  </div>
                </form>
              </div>
            </div>`;

            detailsModal.innerHTML = html;
            detailsModal.style.display = 'block';

            document.getElementById('modalOverlay').addEventListener('click', function() {
                detailsModal.style.display = 'none';
                detailsModal.innerHTML = '';
            });

            document.getElementById('modalContent').addEventListener('click', function(e) {
                e.stopPropagation();
            });
        };

        node.addEventListener('contextmenu', openModalHandler);
        node.addEventListener('click', openModalHandler);

        nodesContainer.appendChild(node);
    });
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

                // Nối chuỗi Path an toàn
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
    const canvasArea = document.getElementById('canvasArea');
    
    // 1. Đổi trạng thái nút để báo cho người dùng biết đang xử lý
    const originalText = exportBtn.innerText;
    exportBtn.innerText = 'Đang tạo PDF...';
    exportBtn.style.backgroundColor = '#95a5a6';
    exportBtn.disabled = true;

    // 2. CHUẨN BỊ CANVAS ĐỂ CHỤP ẢNH
    // Tạm thời xóa bỏ lề, bóng và dịch chuyển để html2canvas chụp đúng mép 100%
    canvasArea.style.margin = '0px';
    canvasArea.style.boxShadow = 'none';
    canvasArea.style.transform = 'none'; 
    
    // Xóa tạm thời hiệu ứng nổi bật (nếu đang có người được tìm kiếm) để bản in đẹp hơn
    document.querySelectorAll('.person-node').forEach(node => node.classList.remove('highlighted'));

    // 3. Cấu hình thông số PDF
    const opt = {
        margin:       0, // Đặt lề PDF bằng 0 tuyệt đối
        filename:     'PhaDoGiaToc.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 1, 
            useCORS: true, 
            logging: false,
            scrollX: 0, // Bỏ qua thanh cuộn ẩn của trình duyệt
            scrollY: 0
        },
        jsPDF:        { unit: 'px', format: [4492, 3177], orientation: 'landscape' } // Cố định hệ quy chiếu pixel khổ A0 ngang
    };

    // 4. Ra lệnh chụp ảnh, xuất file và KHÔI PHỤC TRẠNG THÁI
    html2pdf().set(opt).from(canvasArea).save().then(() => {
        // Trả lại các thuộc tính CSS cũ cho không gian làm việc
        canvasArea.style.margin = ''; 
        canvasArea.style.boxShadow = ''; 
        updateTransform(); // Khôi phục lại mức độ zoom và vị trí kéo thả trước khi in

        // Khôi phục lại nút bấm
        exportBtn.innerText = originalText;
        exportBtn.style.backgroundColor = '#e74c3c';
        exportBtn.disabled = false;
    }).catch(err => {
        console.error("Lỗi khi xuất PDF:", err);
        alert('Có lỗi xảy ra khi xuất PDF. Vui lòng thử lại!');
        
        // Khôi phục khi có lỗi
        canvasArea.style.margin = ''; 
        canvasArea.style.boxShadow = ''; 
        updateTransform();
        exportBtn.innerText = originalText;
        exportBtn.style.backgroundColor = '#e74c3c';
        exportBtn.disabled = false;
    });
}