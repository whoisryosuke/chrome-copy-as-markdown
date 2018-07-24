var get_selection = function() {
    var selection = document.getSelection();

    function domVisitor(node, functionName) {
        functionName(node);
        node = node.firstChild;

        while (node) {
            domVisitor(node, functionName);
            node = node.nextSibling;
        }
    }

    function getSelectionRepresentation() {
        var textRepresentation = {
            type: 'text',
            value: selection.toString()
        };

        if (!selection.rangeCount) {
            return textRepresentation;
        }

        // Grap the HTML
        var container = document.createElement("div");
        for (var i = 0, len = selection.rangeCount; i < len; ++i) {
            container.appendChild(selection.getRangeAt(i).cloneContents());
        }

        // The HTML part is empty: but it could well be that the browser's
        // HTML to text engine did a better job!
        if (container.innerHTML.replace(/\s/g,"") === "") {
            return textRepresentation;
        }

        // Make all links absolute
        domVisitor(container, function (node) {
            if (node.tagName !== 'A') {
                return;
            }

            node.href = node.href;
        });

        return {
            type: 'html',
            value: container.innerHTML,
        };
    }

    // Do the rest
    var node = selection.getRangeAt(0).startContainer;
    var uri = node.baseURI || document.documentURI;
    var parent = node.parentElement;
    var whiteSpace = (parent && window.getComputedStyle(parent)['white-space']);
    var index;
    var ext;
    var is_code = function(elem) {
        if (!elem) return false;

        // Is the element monospace?
        if (window.getComputedStyle(elem)['white-space'].toLowerCase() == 'pre') {
            return true;
        }

        // Is the element generated by CodeMirror?
        if (elem.className.toLowerCase().split(' ').indexOf('codemirror') >= 0) {
            return true;
        }


        return false;
    }
    var pre = is_code(parent);
    var get_frag = function(parent) {
        var frag, sibling, nephew;

        if (!parent) {
            return null;
        }

        frag = parent.id || parent.name;

        if (frag) {
            return frag;
        }

        sibling = parent.previousSibling;

        while(sibling) {
            frag = sibling.id || sibling.name;

            if (frag) {
                return frag;
            }

            nephew = sibling.children && sibling.children[0];
            frag = nephew && (nephew.id || nephew.name);

            if (frag) {
                return frag;
            }

            sibling = sibling.previousSibling;
        }
    }
    var fileName;
    var orig_frag;
    var frag;

    // Remove the fragment from the url and find the better one only if the
    // original one was not semantically significant.
    index = uri.lastIndexOf('#');
    orig_frag = index >= 0 ? uri.substring(index + 1) : null;
    if (!orig_frag || orig_frag.indexOf('/') < 0) { // Assume the fragment is siginificant if it contains '/'.
        uri = index >= 0 ? uri.substring(0, index) : uri;
        while(!frag && parent) {
            frag = get_frag(parent);
            parent = parent.parentElement;
        }
    }

    // Get extension from the url
    index = uri.lastIndexOf('/');
    fileName = index >= 0 ? uri.substring(index + 1) : '';
    index = fileName.lastIndexOf('.');
    ext = index >= 0 ? fileName.substring(index + 1) : '';

    if (frag) {
        uri += '#' + frag;
    }

    return {
        selection: getSelectionRepresentation(),
        uri: uri,
        pre: pre,
        ext: ext
    };
}

function toCleanMarkdown(html) {
    var validTags = [
        'p', 'br', 'hr', 'b', 'pre', 'img', 'code', 'blockquote', 'ol', '', 'h1', 'h2', 'h3',
        'h4', 'h5', 'a', 'strong', 'em', 'a', 'i', 'em', 'ul', 'li',
    ];

    return toMarkdown(html, {
        converters: [
            {
                filter: 'div',
                replacement: function (content) {
                    return '\n\n' + content + '\n\n';
                }
            },
            {
                filter: function (node) {
                    return validTags.indexOf(
                        node.nodeName.toLowerCase()
                    ) === -1;
                },
                replacement: function (content) {
                    return content;
                }
            },
        ]
    });
}

function toMarkdownQuote(markdown) {
    return markdown.split('\n').map(function (line) {
        return '> ' + line;
    }).join('\n');
}

function toMarkdownCodeBlock(markdown, extension) {
    return [
        '> ```' + extension + '\n',
        markdown,
        '> ```\n',
    ].join('');
}

var copy_as_markdown_quot = function (args) {
    chrome.tabs.executeScript( {
          code: "(" + get_selection + ")();"
    }, function(selections) {
        var selection = selections[0].selection;
        var uri = selections[0].uri;
        var pre = selections[0].pre;
        var ext = selections[0].ext;

        var result = selection.type === 'html'
            ? toCleanMarkdown(selection.value)
            : selection.value;

        if (pre) {
            result = toMarkdownCodeBlock(result, ext);
        }

        copyTextToClipboard(result);
    });
};

function copyTextToClipboard(text) {
    var copyFrom, body;

    copyFrom = document.createElement("textarea");
    copyFrom.textContent = text;
    body = document.getElementsByTagName('body')[0];
    body.appendChild(copyFrom);
    copyFrom.select();
    document.execCommand('copy');
    body.removeChild(copyFrom);
}

chrome.contextMenus.create({
    title: "Copy as Markdown",
    contexts: ['selection'],
    onclick: copy_as_markdown_quot
});
