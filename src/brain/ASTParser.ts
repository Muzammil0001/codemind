/**
 * AST Parser - Parses code using tree-sitter for multi-language support
 */

// Import types only, not the actual module
type Parser = any;
type SyntaxNode = any;

import { FunctionNode, ClassNode, ParameterNode, PropertyNode } from '../types';
import { logger } from '../utils/logger';
import * as vscode from 'vscode';

export class ASTParser {
    private parsers: Map<string, Parser> = new Map();
    private initialized = false;
    private Parser: any = null;
    private treeSitterAvailable = false;

    constructor() {
        // Try to load tree-sitter dynamically
        try {
            this.Parser = require('tree-sitter');
            this.treeSitterAvailable = true;
            logger.info('Tree-sitter module loaded successfully');
        } catch (error) {
            logger.warn('Tree-sitter not available - AST parsing will be disabled', error as Error);
        }
    }

    private async initializeParsers(): Promise<void> {
        if (this.initialized || !this.treeSitterAvailable || !this.Parser) {
            return;
        }

        try {
            // TypeScript
            try {
                const TypeScript = require('tree-sitter-typescript');
                const tsParser = new this.Parser();
                tsParser.setLanguage(TypeScript.typescript);
                this.parsers.set('typescript', tsParser);
                this.parsers.set('ts', tsParser);
                this.parsers.set('tsx', tsParser);
            } catch (e) { logger.warn('Failed to load TypeScript parser', e as Error); }

            // JavaScript
            try {
                const JavaScript = require('tree-sitter-javascript');
                const jsParser = new this.Parser();
                jsParser.setLanguage(JavaScript);
                this.parsers.set('javascript', jsParser);
                this.parsers.set('js', jsParser);
                this.parsers.set('jsx', jsParser);
            } catch (e) { logger.warn('Failed to load JavaScript parser', e as Error); }

            // Python
            try {
                const Python = require('tree-sitter-python');
                const pyParser = new this.Parser();
                pyParser.setLanguage(Python);
                this.parsers.set('python', pyParser);
                this.parsers.set('py', pyParser);
            } catch (e) { logger.warn('Failed to load Python parser', e as Error); }

            // Go
            try {
                const Go = require('tree-sitter-go');
                const goParser = new this.Parser();
                goParser.setLanguage(Go);
                this.parsers.set('go', goParser);
            } catch (e) { logger.warn('Failed to load Go parser', e as Error); }

            // Rust
            try {
                const Rust = require('tree-sitter-rust');
                const rustParser = new this.Parser();
                rustParser.setLanguage(Rust);
                this.parsers.set('rust', rustParser);
                this.parsers.set('rs', rustParser);
            } catch (e) { logger.warn('Failed to load Rust parser', e as Error); }

            // Java
            try {
                const Java = require('tree-sitter-java');
                const javaParser = new this.Parser();
                javaParser.setLanguage(Java);
                this.parsers.set('java', javaParser);
            } catch (e) { logger.warn('Failed to load Java parser', e as Error); }

            this.initialized = true;
            logger.info(`Initialized ${this.parsers.size} language parsers`);
        } catch (error) {
            logger.error('Failed to initialize parsers', error as Error);
        }
    }

    async parseFile(filePath: string): Promise<{
        functions: FunctionNode[];
        classes: ClassNode[];
        imports: string[];
        exports: string[];
    }> {
        await this.initializeParsers();
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const language = document.languageId;
            const content = document.getText();

            return this.parseContent(content, language);
        } catch (error) {
            logger.error(`Failed to parse file: ${filePath}`, error as Error);
            return { functions: [], classes: [], imports: [], exports: [] };
        }
    }

    async parseContent(content: string, language: string): Promise<{
        functions: FunctionNode[];
        classes: ClassNode[];
        imports: string[];
        exports: string[];
    }> {
        await this.initializeParsers();
        const parser = this.parsers.get(language);

        if (!parser) {
            logger.warn(`No parser available for language: ${language}`);
            return { functions: [], classes: [], imports: [], exports: [] };
        }

        try {
            const tree = parser.parse(content);
            const rootNode = tree.rootNode;

            const functions = this.extractFunctions(rootNode, content);
            const classes = this.extractClasses(rootNode, content);
            const imports = this.extractImports(rootNode, content);
            const exports = this.extractExports(rootNode, content);

            return { functions, classes, imports, exports };
        } catch (error) {
            logger.error('Failed to parse content', error as Error);
            return { functions: [], classes: [], imports: [], exports: [] };
        }
    }

    private extractFunctions(node: SyntaxNode, content: string): FunctionNode[] {
        const functions: FunctionNode[] = [];

        const functionTypes = [
            'function_declaration',
            'function_expression',
            'arrow_function',
            'method_definition',
            'function_definition' // Python
        ];

        this.traverseNode(node, (n) => {
            if (functionTypes.includes(n.type)) {
                const func = this.parseFunctionNode(n, content);
                if (func) {
                    functions.push(func);
                }
            }
        });

        return functions;
    }

    private parseFunctionNode(node: SyntaxNode, content: string): FunctionNode | null {
        try {
            const nameNode = node.childForFieldName('name');
            const name = nameNode ? content.slice(nameNode.startIndex, nameNode.endIndex) : 'anonymous';

            const parameters = this.extractParameters(node, content);
            const isAsync = content.slice(node.startIndex, node.endIndex).includes('async');
            const isExported = this.isExported(node);

            return {
                name,
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                parameters,
                isAsync,
                isExported,
                calls: [],
                complexity: this.calculateComplexity(node)
            };
        } catch (error) {
            logger.error('Failed to parse function node', error as Error);
            return null;
        }
    }

    private extractClasses(node: SyntaxNode, content: string): ClassNode[] {
        const classes: ClassNode[] = [];

        const classTypes = ['class_declaration', 'class_definition'];

        this.traverseNode(node, (n) => {
            if (classTypes.includes(n.type)) {
                const cls = this.parseClassNode(n, content);
                if (cls) {
                    classes.push(cls);
                }
            }
        });

        return classes;
    }

    private parseClassNode(node: SyntaxNode, content: string): ClassNode | null {
        try {
            const nameNode = node.childForFieldName('name');
            const name = nameNode ? content.slice(nameNode.startIndex, nameNode.endIndex) : 'Anonymous';

            const methods: FunctionNode[] = [];
            const properties: PropertyNode[] = [];

            this.traverseNode(node, (n) => {
                if (n.type === 'method_definition') {
                    const method = this.parseFunctionNode(n, content);
                    if (method) {
                        methods.push(method);
                    }
                } else if (n.type === 'field_definition' || n.type === 'property_declaration') {
                    const property = this.parsePropertyNode(n, content);
                    if (property) {
                        properties.push(property);
                    }
                }
            });

            return {
                name,
                startLine: node.startPosition.row + 1,
                endLine: node.endPosition.row + 1,
                implements: [],
                methods,
                properties,
                isExported: this.isExported(node)
            };
        } catch (error) {
            logger.error('Failed to parse class node', error as Error);
            return null;
        }
    }

    private parsePropertyNode(node: SyntaxNode, content: string): PropertyNode | null {
        try {
            const nameNode = node.childForFieldName('name');
            const name = nameNode ? content.slice(nameNode.startIndex, nameNode.endIndex) : 'unknown';

            return {
                name,
                visibility: 'public',
                isStatic: content.slice(node.startIndex, node.endIndex).includes('static'),
                isReadonly: content.slice(node.startIndex, node.endIndex).includes('readonly')
            };
        } catch (error) {
            return null;
        }
    }

    private extractParameters(node: SyntaxNode, content: string): ParameterNode[] {
        const parameters: ParameterNode[] = [];
        const paramsNode = node.childForFieldName('parameters');

        if (!paramsNode) {
            return parameters;
        }

        for (let i = 0; i < paramsNode.childCount; i++) {
            const child = paramsNode.child(i);
            if (child && (child.type === 'required_parameter' || child.type === 'optional_parameter')) {
                const nameNode = child.childForFieldName('pattern') || child.childForFieldName('name');
                if (nameNode) {
                    const name = content.slice(nameNode.startIndex, nameNode.endIndex);
                    parameters.push({
                        name,
                        optional: child.type === 'optional_parameter'
                    });
                }
            }
        }

        return parameters;
    }

    private extractImports(node: SyntaxNode, content: string): string[] {
        const imports: string[] = [];

        this.traverseNode(node, (n) => {
            if (n.type === 'import_statement' || n.type === 'import_from_statement') {
                const importText = content.slice(n.startIndex, n.endIndex);
                imports.push(importText);
            }
        });

        return imports;
    }

    private extractExports(node: SyntaxNode, content: string): string[] {
        const exports: string[] = [];

        this.traverseNode(node, (n) => {
            if (n.type === 'export_statement') {
                const exportText = content.slice(n.startIndex, n.endIndex);
                exports.push(exportText);
            }
        });

        return exports;
    }

    private isExported(node: SyntaxNode): boolean {
        let current = node.parent;
        while (current) {
            if (current.type === 'export_statement') {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    private calculateComplexity(node: SyntaxNode): number {
        let complexity = 1; // Base complexity

        this.traverseNode(node, (n) => {
            // Increase complexity for control flow statements
            if (['if_statement', 'while_statement', 'for_statement', 'case', 'catch_clause'].includes(n.type)) {
                complexity++;
            }
            // Increase for logical operators
            if (n.type === 'binary_expression' && n.text?.match(/&&|\|\|/)) {
                complexity++;
            }
        });

        return complexity;
    }

    private traverseNode(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
        callback(node);

        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
                this.traverseNode(child, callback);
            }
        }
    }

    getSupportedLanguages(): string[] {
        return Array.from(this.parsers.keys());
    }
}

export const astParser = new ASTParser();
