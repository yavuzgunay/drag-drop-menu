import {Component, DoCheck, ElementRef, Inject, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ToastrService} from 'ngx-toastr';
import {DOCUMENT} from '@angular/common';
import {demoData} from './model/data';
import {TreeNode} from './model/tree-node';
import {DropInfo} from './model/drop-info';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  menuItems: FormGroup;
  activeUpdate = false;
  nodes: TreeNode[] = demoData;
  nodesCached: boolean;
  // ids for connected drop lists
  dropTargetIds = [];
  nodeLookup = {};
  dropActionTodo: DropInfo = null;

  constructor(private toastrService: ToastrService,
              @Inject(DOCUMENT) private document: Document) {

    this.prepareDragDrop(this.nodes);

  }

  ngOnInit(): void {
    this.menuItems = new FormGroup({
      id: new FormControl(''),
      name: new FormControl('', Validators.required),
      link: new FormControl('', Validators.required),
      children: new FormControl('')
    });
    
    // get menu Content items from localstorage
    if (localStorage.getItem('menuContentItems')) {
      this.nodesCached = true;
      this.nodes = JSON.parse(localStorage.getItem('menuContentItems'));
      this.prepareDragDrop(this.nodes);
    }

  }

  selectItemToUpdate(item) {
    this.activeUpdate = true;
    this.fillFormField(item);
  }

  fillFormField(itemMenu: TreeNode) {
    this.menuItems = new FormGroup({
      id: new FormControl(itemMenu.id),
      itemId: new FormControl(itemMenu.itemId),
      name: new FormControl(itemMenu.name, Validators.required),
      link: new FormControl(itemMenu.link, Validators.required),
      children: new FormControl(itemMenu.children)
    });
  }

  deleteItem(event, id) {
    if (event == 'delete') {
      if (confirm('Are you sure you want to delete this item ?')) {
        // Delete Main Item
        this.nodes = this.nodes.filter(item => item.id !== id);
        // Delete Sub Item
        this.nodes = this.nodes.map(item => {
          const childIndex = item.children.findIndex(c => c.id == id);
          if (childIndex != -1) {
            item.children.splice(childIndex, 1);
          }
          return item;
        });

        this.saveMenuContentItems(this.nodes);
      }
    }
  }

  newItem() {
    const itemListId = [];
    if (!this.menuItems.valid) {
      this.toastrService.error('Form Not Valid');
      return;
    }
    // get form value
    const formObject = this.menuItems.getRawValue();
    // get all items list id
    this.nodes.forEach((list, index) => {
      itemListId.push(list.id);
    });
    // get new item id
    formObject.id = itemListId.length == 0  ? 1 : Math.max(...itemListId) + 1;
    formObject.itemId = 'item-' + formObject.id;
    formObject.children = [];
    this.nodes.push(formObject);
    this.nodeLookup[formObject.itemId] = formObject;
    // store the itemList into localStorage
    this.saveMenuContentItems(this.nodes);
    // reset form input
    this.menuItems.reset();
  }

  updateItem(event) {
    if (!this.menuItems.valid) {
      this.toastrService.error('Form Not Valid');
      return;
    }
    const formObject = this.menuItems.getRawValue();

    this.nodes = this.nodes.map(node => {
      return node.id == formObject.id ? formObject : node;
    });
    this.nodeLookup[formObject.itemId] = formObject;

    // Modify item in sub array
    this.nodes = this.nodes.map(item => {
      const childIndex = item.children.findIndex(c => c.id == formObject.id);
      if (childIndex != -1) {
        item.children.splice(childIndex, 1, formObject);
      }
      return item;
    });
    console.log('updateItem : ', this.nodes);
    // store the itemList into localStorage
    this.saveMenuContentItems(this.nodes);
    // switch to create form after updated item
    this.activeUpdate = false;
    // reset form input
    this.menuItems.reset();
  }

  saveMenuContentItems(data) {
    this.nodesCached = true;
    if (!localStorage.getItem('menuContentItems')) {
      localStorage.setItem('menuContentItems', JSON.stringify(data));
    } else {
      localStorage.removeItem('menuContentItems');
      localStorage.setItem('menuContentItems', JSON.stringify(data));
    }
  }

  saveMenu() {
    this.saveMenuContentItems(this.nodes);
    this.toastrService.success('Menu Successfully Saved');
  }


  prepareDragDrop(nodes: TreeNode[]) {
    nodes.forEach(node => {
      this.dropTargetIds.push(node.itemId);
      this.nodeLookup[node.itemId] = node;
      this.prepareDragDrop(node.children);
    });
  }

  // @debounce(50)
  dragMoved(event) {
    const e = this.document.elementFromPoint(event.pointerPosition.x, event.pointerPosition.y);
    
    if (!e) {
      this.clearDragInfo();
      return;
    }
    // (e.classList.contains('node-item') == true) thats mean we are inside item that has children
    const hoveredItem = e.classList.contains('node-item') ? e : e.closest('.node-item');
    
    if (!hoveredItem) {
      this.clearDragInfo();
      return;
    }
    this.dropActionTodo = {
      targetId: hoveredItem.getAttribute('data-id')
    };
    
    const targetRect = hoveredItem.getBoundingClientRect();
    const oneThird = targetRect.height / 3;
    
    if (event.pointerPosition.y - targetRect.top < oneThird) {
      // before
      this.dropActionTodo['action'] = 'before';
    } else if (event.pointerPosition.y - targetRect.top > 2 * oneThird) {
      // after
      this.dropActionTodo['action'] = 'after';
    } else {
      // inside
      this.dropActionTodo['action'] = 'inside';
    }
    // console.log('drag : ', this.nodes);

    this.showDragInfo();
  }


  drop(event) {
    this.nodesCached = false; 
    if (!this.dropActionTodo) { return; }

    const selectedDragedItemId = event.item.data;
    const oldParentId = event.previousContainer.id;
    const parentId = this.getParentNodeId(this.dropActionTodo.targetId, this.nodes, 'main');
    const selectedDragedItem = this.nodeLookup[selectedDragedItemId];

    const oldContainerItems = oldParentId != 'main' ? this.nodeLookup[oldParentId].children : this.nodes;
    const newContainer = parentId != 'main' ? this.nodeLookup[parentId].children : this.nodes;
    // Get index for selected Draged Item
    const selectedDragItemIndex = oldContainerItems.findIndex(c => c.itemId === selectedDragedItemId);
    
    // remove the item that selected
    oldContainerItems.splice(selectedDragItemIndex, 1);
   
    switch (this.dropActionTodo.action) {
      case 'before':
      case 'after':
        const targetIndex = newContainer.findIndex(c => {
          return c.itemId === this.dropActionTodo.targetId;
        });

        if (this.dropActionTodo.action == 'before') {
          newContainer.splice(targetIndex, 0, selectedDragedItem);
        } else {
          newContainer.splice(targetIndex + 1, 0, selectedDragedItem);
        }

        if (this.nodesCached) {
          // from outsite to inside
          if (oldParentId != parentId && oldParentId == 'main') {
            let newNode = []; 
              newNode = oldContainerItems.map(i => {
                if (parentId == i.itemId) {
                  i.children = [];
                  i.children = newContainer;
                  this.nodeLookup[this.dropActionTodo.targetId] = i;
                }
              });
          }
          if (oldParentId != parentId && parentId == 'main') {
            let newNode = [];
              newNode = newContainer.map(i => {
                if (oldParentId == i.itemId) {
                    i.children = [];
                    i.children = oldContainerItems;
                }
              });
          }
        }
        break;

      case 'inside':
        // debugger;
        this.nodeLookup[this.dropActionTodo.targetId].children.push(selectedDragedItem);
        this.nodeLookup[this.dropActionTodo.targetId].isExpanded = true;
        if (this.nodesCached) {
          if (parentId == oldParentId) {
            newContainer.forEach((e, i) => {
              if (this.dropActionTodo.targetId == e.itemId) { 
                console.log('i', i);
                console.log(i, newContainer);
                newContainer.splice(i, 1);
                return newContainer.splice(i, 0, this.nodeLookup[this.dropActionTodo.targetId]);
                // newContainer[i] = this.nodeLookup[this.dropActionTodo.targetId];
              }
            }); 
          }
          if (parentId != oldParentId) {
            oldContainerItems.forEach((e, i) => {
              if (this.dropActionTodo.targetId == e.itemId) { 
                console.log('i', i);
                console.log(i, oldContainerItems);
                oldContainerItems.splice(i, 1);
                return oldContainerItems.splice(i, 0, this.nodeLookup[this.dropActionTodo.targetId]);
                // newContainer[i] = this.nodeLookup[this.dropActionTodo.targetId];
              }
            }); 
          }
        }
        console.log('newNode', newContainer);
        // newNode.push(this.nodeLookup[this.dropActionTodo.targetId]);
        // console.log('newNode', newNode);
        console.log('oldContainerItems', oldContainerItems);
        console.log('newContainer' , newContainer);
        console.log('oldParentId' , oldParentId);
        console.log('parentId' , parentId);
        console.log('targetId',this.dropActionTodo.targetId);
        console.log('target',);
        // this.nodes = newNode;
        break;
    }
    this.clearDragInfo(true);
  }

  getParentNodeId(id: string, nodesToSearch: TreeNode[], parentId: string): string {
    if (nodesToSearch) {
      for (const node of nodesToSearch) {
        if (node.itemId == id) { return parentId; }
        const ret = this.getParentNodeId(id, node.children, node.itemId);
        if (ret) { return ret; }
      }
    }

    return null;
  }

  showDragInfo() {
    this.clearDragInfo();
    if (this.dropActionTodo) {
      this.document.getElementById('node-' + this.dropActionTodo.targetId).classList.add('drop-' + this.dropActionTodo.action);
    }
  }

  clearDragInfo(dropped = false) {
    if (dropped) {
      this.dropActionTodo = null;
    }
    this.document
      .querySelectorAll('.drop-before')
      .forEach(element => element.classList.remove('drop-before'));
    this.document
      .querySelectorAll('.drop-after')
      .forEach(element => element.classList.remove('drop-after'));
    this.document
      .querySelectorAll('.drop-inside')
      .forEach(element => element.classList.remove('drop-inside'));
  }

}
