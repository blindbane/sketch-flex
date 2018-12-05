import sketch from 'sketch'
const util = require('sketch-utils')
const utily = require('util')
import parseCss from 'cssjson'
import yoga, {Node} from 'yoga-layout';
var newLayers = [];
function getDocument(sketch) {
  let selectedDocument = sketch.getSelectedDocument()

  // TODO: Improve default fallback logic.  Currently just using first document.
  if (typeof selectedDocument !== 'object') {
    const openDocuments = sketch.getDocuments()

    if (openDocuments.length) {
      selectedDocument = openDocuments[0]
      log(`LOG: No document selected. Document at ${selectedDocument.path} used as fallback.`)
    } else {
      log('ERROR: There are no open sketch files.')
    }
  }

  return selectedDocument; 
}

function getSelectedPage(doc) {
  return doc.selectedPage || doc.pages
}

function getPageLayers(page) {
  return page.layers
}

function getStylesLayer(pageLayers) {
  const stylesLayer = pageLayers.filter(({ name }) => name === "@styles")
  
  if (stylesLayer.length === 0) {
    log('ERROR: No "@styles" layer found.')
  }

  return stylesLayer[0]
}

function parseStyles(stylesLayer) {
  if (stylesLayer.type !== 'Text') {
    log(`ERROR: parseStyles's stylesLayer argument must be a text layer.`)
    return undefined;
  }

  const css =  stylesLayer.text
  const parsedCss = parseCss.toJSON(css).children

  return (parsedCss)
}

function updateSketchLayers(styles, pageLayer) {
  var layerInfo = {};
  var layerName = pageLayer.name;
  layerInfo.name = layerName;

  if (layerName == '@styles' || pageLayer.type == "Page") {
    // ignore @styles and pages
  } else {
    for (var classSelector of Object.keys(styles)) {
      if (layerName.endsWith(classSelector)) {
        var style = styles[classSelector];
        layerInfo.style = style.attributes;
      }
    }
  }

  if (pageLayer.type == 'Group' || pageLayer.type == "Artboard") {    
      if (pageLayer.type == 'Artboard') {
        layerInfo.type = 'Artboard';
        const {x, y, width, height} = pageLayer.frame; 
        layerInfo.frame = {x, y, width, height};
      }
  
      var childrenArray = [];
      pageLayer.layers.forEach(node => {
          var childLayerInfo = updateSketchLayers(styles, node);
          //todo - in case stylesheet is somewhere deep we should remove this
          childrenArray.push(childLayerInfo)
        })
      
      layerInfo.layers = childrenArray
    }
  return layerInfo
} 

function computeStyles(rootNode, styles) {
  const newNode = JSON.parse(JSON.stringify(rootNode));

  function getClassNames(styles) {
    return Object.keys(styles);
  }
    
  function getClassAttrValue(className, attribute) {
    return Number(styles[className].attributes[attribute])
  }

    const keys = getClassNames(styles);
    const root = Node.create();  
    const newNewLayers = [];
    if (keys.find(key => rootNode.name.endsWith(key))) {
      let key = keys.find(key => rootNode.name.endsWith(key))
      // TODO: handle 0 values
      if (getClassAttrValue(key, 'width')) {
        root.setWidth(getClassAttrValue(key, 'width'))
        // root.setFlexBasis(yoga.UNIT_AUTO)
        // root.setFlexBasis(getClassAttrValue(key, 'width'))
        root.setFlexGrow(0);
      }
      if (getClassAttrValue(key, 'height')) {
        root.setHeight(getClassAttrValue(key, 'height'))
      }
    } else if (rootNode.type == 'Artboard') {
      root.setHeight(rootNode.frame.height); 
      root.setWidth(rootNode.frame.width); 
      root.setFlex();
      root.setFlexDirection(yoga.FLEX_DIRECTION_ROW);
      root.setJustifyContent(yoga.JUSTIFY_FLEX_START)
      root.setAlignContent(yoga.ALIGN_STRETCH);
    }
    
    if (rootNode && rootNode.layers && rootNode.layers.length > 0) {
      log(`${rootNode.name} has layers!`)
      rootNode.layers.forEach(layer => {
        const newComp = computeStyles(layer, styles);
        newNewLayers.push(newComp.root)
      }) 
    }

    newLayers = newLayers.concat(newNewLayers)
    
    return { newNode, root, calculatedLayout: root.getComputedLayout() };
}

export default function() {
  
  const doc = getDocument(sketch)
  if (typeof doc !== "object") {
    log(`ERROR: Please select a document to export. Typeof document is ${typeof doc}. Document value is: ${doc}`)
    return;
  }
  
  const selectedPage = getSelectedPage(doc)
  // log(selectedPage)

  const pageLayers = getPageLayers(selectedPage)
  // log(JSON.parse(JSON.stringify(util.toArray(pageLayers))))

  const stylesLayer = getStylesLayer(pageLayers)
  // log(stylesLayer)
  
  const styles = parseStyles(stylesLayer);
  // log(styles)

  const updatedSketchLayers = util.toArray(pageLayers).map(layer => updateSketchLayers(styles, layer))
  // log(`updatedSketchLayers`)

  // log('computedStyles start')
  const computedStyles = computeStyles(updatedSketchLayers[0], styles)
  // log('computedStyles end')
  
  newLayers.forEach((l, index) => {
    computedStyles.root.insertChild(l, index);
  });
  
  computedStyles.root.calculateLayout()
  
  newLayers.forEach(function (l) {
    console.log(l.getComputedLayout())
  })
  console.log(computedStyles.root.getComputedLayout())
}
